import json
import asyncio
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
async def init_chat(payload: InitChatRequest, user: dict = Depends(get_current_user)):
    """Initialize a new chat session and draft event for the authenticated user."""
    user_id = user["uid"]

    # Build optional event data from the request payload
    event_data: dict = {
        "name": payload.name,
        "description": payload.description,
    }
    if payload.event_type is not None:
        event_data["metadata"] = {"event_type": payload.event_type}

    # Create draft event + chat session in a single batch write
    result = await firestore_service.create_event_and_session(user_id, event_data=event_data)

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
    
    # Iterate through the ADK TraceEvent timeline
    for event in session.events:
        if event.type == "human_input":
            parts = event.payload.parts
            text = "\n".join([p.text for p in parts if p.text])
            messages.append({
                "type": "message",
                "role": "user",
                "text": text,
                "timestamp": event.timestamp.isoformat() if event.timestamp else None
            })
        elif event.type == "agent_output" and event.payload.get("is_final_response"):
            content = event.payload.get("content", {})
            parts = content.get("parts", [])
            raw_text = "\n".join([p.get("text", "") for p in parts if p.get("text")])
            
            # Use same logic as WS to parse JSON and extract text + media_refs
            try:
                data = json.loads(raw_text)
                if isinstance(data, dict) and "data" in data:
                    text_content = data["data"].get("text", str(data["data"]))
                    media_refs = data.get("media_assets", [])
                    messages.append({
                        "type": "message", 
                        "role": "assistant", 
                        "text": text_content, 
                        "media_refs": media_refs,
                        "timestamp": event.timestamp.isoformat() if event.timestamp else None
                    })
                    continue
            except json.JSONDecodeError:
                pass
                
            messages.append({
                "type": "message",
                "role": "assistant",
                "text": raw_text,
                "timestamp": event.timestamp.isoformat() if event.timestamp else None
            })
            
    return {"messages": messages}


def _replace_gcs_urls_with_public(text: str) -> str:
    """Find gs:// URLs in markdown text and replace with https://storage.googleapis.com/..."""
    # Pattern looks for gs:// followed by non-whitespace/non-closing-bracket chars
    pattern = r"gs://[^\s\)\]\"\'\>]+"
    
    def replace_match(match):
        return gs_to_public_url(match.group(0))
        
    return re.sub(pattern, replace_match, text)


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

    # Get or Create the ADK session using the explicitly provided IDs
    existing = await session_service.get_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )
    if not existing:
        await session_service.create_session(
            app_name=app_name, user_id=user_id, session_id=session_id
        )

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
                    "image_url": request_data.get("image_url", None)
                }
            except json.JSONDecodeError:
                user_msg = {"text": raw_data, "image_url": None}
            
            if user_msg["text"].strip() or user_msg["image_url"]:
                await message_queue.put(user_msg)

    async def downstream_task() -> None:
        """Pulls messages from the queue and runs the ADK agent, sending responses back."""
        while True:
            user_msg = await message_queue.get()
            
            parts = []
            if user_msg["text"].strip():
                parts.append(types.Part.from_text(text=user_msg["text"]))
            
            if user_msg["image_url"]:
                try:
                    # process the image synchronously in a worker thread so we don't block the async loop
                    img_part = await asyncio.to_thread(process_image, user_msg["image_url"])
                    parts.append(img_part)
                except Exception as e:
                    logger.error(f"Failed to to_thread process_image: {e}")
            
            # Pass the user's message to the ADK runner
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=types.Content(
                    role="user", 
                    parts=parts
                ),
                state={"user_id": user_id, "event_id": event_id, "session_id": session_id}
            ):
                # When the agent responds, send it back to the client
                if event.is_final_response():
                    text_parts = [p.text for p in event.content.parts if p.text]
                    raw_response_text = "\n".join(text_parts)
                    
                    response_payload = {
                        "type": "message",
                        "author": event.author,
                        "text": raw_response_text
                    }
                    
                    # Try parsing as JSON to extract media_refs from multimodal content tools
                    try:
                        data = json.loads(raw_response_text)
                        if isinstance(data, dict) and "data" in data:
                            # 1. Extract the prose text (could be in data.text or just dumping data)
                            text_content = data["data"].get("text", str(data["data"]))
                            
                            # 2. Extract media references
                            media_refs = data.get("media_assets", [])
                            
                            response_payload["text"] = _replace_gcs_urls_with_public(text_content)
                            response_payload["media_refs"] = media_refs
                    except json.JSONDecodeError:
                        # Standard prose response, just tidy up any GS URLs
                        response_payload["text"] = _replace_gcs_urls_with_public(raw_response_text)
                        
                    await websocket.send_json(response_payload)
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

