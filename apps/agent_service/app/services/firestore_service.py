"""Firestore service for session and event persistence."""
import asyncio
from typing import Optional, Dict, Any
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter, And
from ..config import settings

import logging

# Initialize client lazily to prevent DefaultCredentialsError on import
_db = None
logger = logging.getLogger(__name__)

def get_db() -> firestore.AsyncClient:
    global _db
    if _db is None:
        _db = firestore.AsyncClient(project=settings.firebase_project_id)
    return _db


async def create_event_and_session(user_id: str) -> Dict[str, str]:
    """
    Creates a draft event and a new chat session in a single transaction/batch.
    Returns a dict with 'event_id' and 'session_id'.
    """
    try:
        db = get_db()
        batch = db.batch()
        
        event_ref = db.collection("events").document()
        batch.set(event_ref, {"user_id": user_id})
        
        session_ref = db.collection("chat_sessions").document()
        batch.set(session_ref, {
            "session_id": session_ref.id,
            "user_id": user_id,
            "event_id": event_ref.id,
            "status": "active",
            "created_at": firestore.SERVER_TIMESTAMP,
            "metadata": {}
        })
        
        await batch.commit()
        return {"event_id": event_ref.id, "session_id": session_ref.id}
    except Exception as e:
        logger.error(f"Error creating event and session for user {user_id}: {e}")
        raise


async def update_event(event_id: str, event_data: Dict[str, Any]) -> None:
    """Updates an existing event's info in the top-level collection."""
    try:
        doc_ref = get_db().collection("events").document(event_id)
        await doc_ref.set(event_data, merge=True)
    except Exception as e:
        logger.error(f"Error updating event {event_id}: {e}")
        raise

