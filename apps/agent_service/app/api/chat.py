import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from firebase_admin import auth as fb_auth

import logging
logger = logging.getLogger(__name__)

from ..config import settings
from ..services import firestore_service
from .auth import get_current_user
from ..models.chat import InitChatRequest, InitChatResponse
from google.genai import types
from app.utils.helpers import process_image

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
                    response_text = "\n".join(text_parts)
                    await websocket.send_json({
                        "type": "message",
                        "author": event.author,
                        "text": response_text
                    })
            message_queue.task_done()

    try:
        logger.debug("Starting asyncio.gather for upstream and downstream tasks")
        await asyncio.gather(upstream_task(), downstream_task())
        logger.debug("asyncio.gather completed normally")
    except WebSocketDisconnect:
        # User disconnected usually
        logger.debug("Client disconnected normally")
        pass
    except asyncio.CancelledError:
        logger.debug("asyncio.gather was cancelled")
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason="Internal error")
