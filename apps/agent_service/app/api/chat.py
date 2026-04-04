import json
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException, Request
from firebase_admin import auth as fb_auth

import logging
logger = logging.getLogger(__name__)

from ..config import settings
from ..services import firestore_service
from .auth import get_current_user
from ..models.chat import InitChatRequest, InitChatResponse
from google.genai import types
from app.utils.helpers import process_image
from app.services.firestore_service import gs_to_public_url
import re

router = APIRouter()

@router.post("/chat/init", response_model=InitChatResponse)
async def init_chat(payload: InitChatRequest, request: Request, user: dict = Depends(get_current_user)):
    """Initialize a new chat session and draft event for the authenticated user."""
    user_id = user["uid"]
    session_service = request.app.state.session_service
    app_name = settings.agent_app_name

    # 1. Pre-generate the event ID so we can seed it into the ADK session state
    #    This ensures all downstream agents (even the first one) have the ID.
    event_id = firestore_service.generate_document_id()
    
    # 2. Build initial event_data in the nested Event+EventMetadata shape.
    #    This is the canonical shape used by both Firestore and agent session state.
    metadata: dict = {}
    if payload.event_type:
        metadata["event_type"] = payload.event_type

    event_data: dict = {"name": payload.name}
    if payload.description:
        event_data["description"] = payload.description
    if metadata:
        event_data["metadata"] = metadata

    # 3. Let the session service generate the session (and its ID).
    #    Seed it with the event_id and the same nested event_info dict.
    adk_session = await session_service.create_session(
        app_name=app_name,
        user_id=user_id,
        state={
            "event_id": event_id,
            "event_info": event_data,  # nested shape — agents read/write this
        }
    )
    generated_session_id = adk_session.id
    logger.info(f"Created ADK session {generated_session_id} for user {user_id} with event_id {event_id}")

    # 4. Create draft event + chat session record in Firestore,
    #    using the session ID and event ID we've established.
    #    event_data now shared the same shape as event_info.
    result = await firestore_service.create_event_and_session(
        user_id, 
        event_data=event_data, 
        session_id=generated_session_id,
        event_id=event_id
    )

    return result


@router.get("/chat/{session_id}/history")
async def get_chat_history(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Fetch the full chat history for a session to reconstruct the timeline."""
    # Access session_service from app state (set in main.py) to avoid circular imports
    session_service = request.app.state.session_service
    
    app_name = settings.agent_app_name
    user_id = user["uid"]
    
    session = await session_service.get_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    messages: List[Dict] = []
    
    
    # Iterate through the ADK session timeline
    for event in session.events:
        role = "user" if event.author == "user" else "assistant"
        
        # In 1.x, content is in event.content (which is a types.Content)
        if not event.content or not event.content.parts:
            continue
            
        parts = event.content.parts
        raw_text = "\n".join([p.text for p in parts if p.text])
        
        # Only include final responses for assistant or any user input
        if role == "assistant" and not event.is_final_response():
            continue

        ts_str = datetime.fromtimestamp(event.timestamp, tz=timezone.utc).isoformat() if event.timestamp else None
        
        msg = {
            "type": "message",
            "role": role,
            "text": raw_text,
            "timestamp": ts_str
        }

        # Try parsing as JSON to extract media_refs for assistant responses
        if role == "assistant":
            try:
                # Strip markdown fences before parsing
                json_text = _strip_markdown_fences(raw_text)
                data = json.loads(json_text)
                if isinstance(data, dict) and "data" in data:
                    text_content = data["data"].get("text", str(data["data"]))
                    media_refs = data.get("media_assets", [])
                    msg["text"] = _replace_gcs_urls_with_public(text_content)
                    msg["media_refs"] = media_refs
            except (json.JSONDecodeError, TypeError):
                msg["text"] = _replace_gcs_urls_with_public(raw_text)
        
        messages.append(msg)
            
    return {"messages": messages}


def _replace_gcs_urls_with_public(text: str) -> str:
    """Find gs:// URLs in markdown text and replace with https://storage.googleapis.com/..."""
    # Pattern looks for gs:// followed by non-whitespace/non-closing-bracket chars
    pattern = r"gs://[^\s\)\]\"\'\>]+"
    
    def replace_match(match):
        return gs_to_public_url(match.group(0))
        
    return re.sub(pattern, replace_match, text)


def _strip_markdown_fences(text: str) -> str:
    """Robustly extracts JSON from a string that might contain markdown fences or extra text."""
    text = text.strip()
    
    # 1. Try to find content inside deliberate JSON code blocks
    json_block_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_block_match:
        return json_block_match.group(1).strip()
    
    # 2. If no fences, try to find the first { and last } pair (brute force extraction)
    brute_match = re.search(r"(\{.*\})", text, re.DOTALL)
    if brute_match:
        return brute_match.group(1).strip()

    # 3. Fallback to existing manual stripping for edge cases or simple responses
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline:].strip()
        else:
            text = text[3:].strip()
            
    if text.endswith("```"):
        text = text[:-3].strip()
        
    return text.strip()


@router.websocket("/chat/ws/{event_id}/{user_id}/{session_id}")
async def chat_ws(websocket: WebSocket, event_id: str, user_id: str, session_id: str, token: str = Query(...)):
    """WebSocket endpoint for the agent chat."""
    
    # Authenticate via Firebase token in query string
    try:
        claims = fb_auth.verify_id_token(token)
        if claims["uid"] != user_id:
            await websocket.close(code=1008, reason="User ID does not match token")
            return
    except Exception as e:
        await websocket.close(code=1008, reason=f"Invalid token: {e}")
        return

    # Runner and session_service are attached to the app state
    app_name = settings.agent_app_name
    runner = websocket.app.state.runner
    session_service = websocket.app.state.session_service

    # Get the ADK session — it should already exist from init_chat.
    # If not found, create a new one (letting the service generate the ID).
    existing_session = await session_service.get_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )
    if not existing_session:
        logger.warning(f"Session {session_id} not found in session service for user {user_id}. Creating a new one.")
        new_session = await session_service.create_session(
            app_name=app_name, 
            user_id=user_id,
            state={"event_id": event_id}
        )
        # Update the session_id to match what the service generated
        session_id = new_session.id
        logger.info(f"Created new ADK session {session_id} for user {user_id}")
        existing_session = new_session

        # Persist the new session_id in Firestore so future lookups
        # via GET /events/{event_id}/session return the correct ID.
        try:
            updated = await firestore_service.update_session_id_for_event(event_id, session_id)
            if updated:
                logger.info(f"Updated Firestore session record for event {event_id} with new session_id {session_id}")
            else:
                logger.warning(f"No Firestore session record found to update for event {event_id}")
        except Exception as e:
            logger.error(f"Failed to update Firestore session record for event {event_id}: {e}")

    # Ensure event_id is in session state (fallback for existing sessions)
    if "event_id" not in existing_session.state:
        existing_session.state["event_id"] = event_id

    # Seed initial event data from Firestore if not already in state.
    # The Firestore doc is already in the nested Event+EventMetadata shape,
    # so we can use it directly as event_info without any remapping.
    if "event_info" not in existing_session.state or not existing_session.state["event_info"]:
        try:
            event = await firestore_service.get_event_by_id(event_id)
            if event:
                # Strip Firestore-only fields that agents don't need to see.
                _skip = {"id", "created_at", "updated_at", "created_by", "updated_by", "status"}
                event_info = {k: v for k, v in event.items() if k not in _skip and v}
                existing_session.state["event_info"] = event_info
                logger.info(f"Seeded event_info from Firestore for session {session_id}")
        except Exception as e:
            logger.error(f"Failed to seed event_info for session {session_id}: {e}")

    await websocket.accept()

    message_queue = asyncio.Queue()

    async def upstream_task() -> None:
        """Receives messages from WebSocket and places them in the queue."""
        while True:
            raw_data = await websocket.receive_text()
            try:
                request_data = json.loads(raw_data)
                user_msg = {
                    "text": request_data.get("text", ""),
                    # Support both single image_url (legacy) and image_urls (list)
                    "image_urls": request_data.get("image_urls", [])
                }
            except json.JSONDecodeError:
                user_msg = {"text": raw_data, "image_urls": []}
            
            if user_msg["text"].strip() or user_msg["image_urls"]:
                # pyre-ignore[16, 24]
                logger.info(f"Queueing user message for session {session_id}: {user_msg['text'][:50]}... ({len(user_msg['image_urls'])} image(s))")
                await message_queue.put(user_msg)
            else:
                logger.info(f"Ignoring empty message for session {session_id}")

    async def downstream_task() -> None:
        """Pulls messages from the queue and runs the ADK agent, sending responses back."""
        while True:
            user_msg = await message_queue.get()
            
            parts = []
            if user_msg["text"].strip():
                parts.append(types.Part.from_text(text=user_msg["text"]))
            
            # Process all uploaded images into multimodal Parts for the agent
            for img_url in user_msg.get("image_urls", []):
                try:
                    img_part = await asyncio.to_thread(process_image, img_url)
                    parts.append(img_part)
                    logger.info(f"Processed user image: {img_url}")
                except Exception as e:
                    logger.error(f"Failed to process user image {img_url}: {e}")
            
            # Pass the user's message to the ADK runner
            logger.info(f"Running agent for user={user_id}, session={session_id}")
            
            # Capture state before run to detect changes (e.g. via EventInfoGatherer)
            state_before = json.dumps(existing_session.state.get("event_info", {}), sort_keys=True)

            # Signal to the client that the agent is working —
            # image generation can take 30+ seconds, so the UI shows a loader.
            await websocket.send_json({"type": "thinking"})
            
            event_count = 0
            try:
                async for event in runner.run_async(
                    user_id=user_id,
                    session_id=session_id,
                    new_message=types.Content(
                        role="user", 
                        parts=parts
                    )
                ):
                    event_count += 1
                    logger.info(f"Agent event {event_count} received: author={event.author}, type={type(event)}")
                    # When the agent responds, send it back to the client
                    if event.is_final_response():
                        text_parts = []
                        for p in event.content.parts:
                            if hasattr(p, 'text') and p.text:
                                text_parts.append(p.text)
                        raw_response_text = "\n".join(text_parts)
                        
                        response_payload = {
                            "type": "message",
                            "author": event.author,
                            "text": raw_response_text
                        }

                        # Diagnostic: log raw response so we can verify JSON + image pipeline
                        logger.info(
                            f"[chat.py] Raw response from {event.author} "
                            f"(first 300 chars): {raw_response_text[:300]!r}"
                        )
                        
                        # Try parsing as JSON to extract media_refs from multimodal content tools
                        try:
                            # Strip markdown fences before parsing
                            json_text = _strip_markdown_fences(raw_response_text)
                            data = json.loads(json_text)
                            if isinstance(data, dict) and "data" in data:
                                # 1. Extract the prose text (could be in data.text or just dumping data)
                                text_content = data["data"].get("text", str(data["data"]))
                                
                                # 2. Extract media references
                                media_refs = data.get("media_assets", [])
                                
                                response_payload["text"] = _replace_gcs_urls_with_public(text_content)
                                response_payload["media_refs"] = media_refs
                                logger.info(
                                    f"[chat.py] JSON parsed OK — media_assets count: {len(media_refs)}. "
                                    f"Asset IDs: {[m.get('asset_id') for m in media_refs]}"
                                )
                            else:
                                logger.warning(
                                    f"[chat.py] JSON parsed but no 'data' key — keys: {list(data.keys()) if isinstance(data, dict) else 'N/A'}"
                                )
                        except json.JSONDecodeError:
                            # Standard prose response (not JSON) — ContentGenerationManager likely
                            # generated content directly instead of delegating to ContentGenerator.
                            logger.warning(
                                "[chat.py] Response is NOT JSON — ContentGenerator tool may not have been called. "
                                "No images will be shown. Check agent logs for tool invocations."
                            )
                            response_payload["text"] = _replace_gcs_urls_with_public(raw_response_text)
                            
                        await websocket.send_json(response_payload)
                        logger.info(f"Sent final response to client for session {session_id}")

                # After the run finishes, check if the event_info state changed
                state_after = json.dumps(existing_session.state.get("event_info", {}), sort_keys=True)
                if state_before != state_after:
                    logger.info(f"State change detected for session {session_id}, notifying frontend.")
                    await websocket.send_json({
                        "type": "state_update",
                        "event_info": existing_session.state["event_info"]
                    })
            except Exception as e:
                import traceback
                error_msg = f"Oops! I encountered an error while processing that request: {str(e)}\n\nThis usually means the generative models are temporarily busy or rate-limited. Please try repeating your request."
                logger.error(f"Runner loop crashed for user={user_id}, session={session_id}: {repr(e)}\n{traceback.format_exc()}")
                await websocket.send_json({
                    "type": "error",
                    "author": "System",
                    "text": error_msg
                })
            finally:
                message_queue.task_done()

    try:
        logger.debug("Starting asyncio.gather for upstream and downstream tasks")
        await asyncio.gather(upstream_task(), downstream_task())
        logger.debug("asyncio.gather completed normally")
    except WebSocketDisconnect:
        logger.debug("Client disconnected normally")
    except asyncio.CancelledError:
        logger.debug("asyncio.gather was cancelled")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason="Internal error")

