"""Firestore service for session and event persistence."""
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List

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


def _normalize_timestamps(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert Firestore Timestamp objects to native datetimes for known fields."""
    for field in ("created_at", "updated_at", "start_time", "end_time"):
        value = data.get(field)
        # Firestore Timestamp has a to_datetime() method; guard via duck typing
        if value is not None and hasattr(value, "to_datetime"):
            data[field] = value.to_datetime()
    return data


async def create_event_and_session(
    user_id: str,
    event_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, str]:
    """
    Creates a draft event and a new chat session in a single batch write.
    Optionally merges additional event_data (name, description, metadata, etc.)
    into the event document at creation time.
    Returns a dict with 'event_id' and 'session_id'.
    """
    try:
        db = get_db()
        batch = db.batch()

        # Build the base event document
        event_doc: Dict[str, Any] = {
            "created_by": user_id,
            "updated_by": user_id,
            "status": "draft",
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }

        # Merge any caller-supplied fields (name, description, metadata, …)
        if event_data:
            event_doc.update(event_data)

        event_ref = db.collection("events").document()
        batch.set(event_ref, event_doc)

        session_ref = db.collection("chat_sessions").document()
        batch.set(
            session_ref,
            {
                "session_id": session_ref.id,
                "user_id": user_id,
                "event_id": event_ref.id,
                "status": "active",
                "created_at": firestore.SERVER_TIMESTAMP,
                "metadata": {},
            },
        )

        await batch.commit()
        return {"event_id": event_ref.id, "session_id": session_ref.id}
    except Exception as e:
        logger.error(f"Error creating event and session for user {user_id}: {e}")
        raise


async def update_event(event_id: str, event_data: Dict[str, Any]) -> None:
    """Updates an existing event's info in the top-level collection."""
    try:
        doc_ref = get_db().collection("events").document(event_id)
        data = dict(event_data)
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        await doc_ref.set(data, merge=True)
    except Exception as e:
        logger.error(f"Error updating event {event_id}: {e}")
        raise


async def get_events_for_user(user_id: str, offset: int, limit: int) -> List[Dict[str, Any]]:
    """
    Returns a page of events for a given user, ordered by updated_at descending.
    """
    try:
        db = get_db()
        query = (
            db.collection("events")
            .where("created_by", "==", user_id)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
        )

        # Apply offset/limit; for small datasets this is fine for now.
        query = query.offset(offset).limit(limit)

        results: List[Dict[str, Any]] = []
        async for doc in query.stream():
            data = doc.to_dict() or {}
            data["id"] = doc.id
            results.append(_normalize_timestamps(data))
        return results
    except Exception as e:
        logger.error(f"Error fetching events for user {user_id}: {e}")
        raise


async def count_events_for_user(user_id: str) -> int:
    """
    Counts total number of events for a given user.
    """
    try:
        db = get_db()
        query = db.collection("events").where("created_by", "==", user_id)
        count = 0
        async for _ in query.stream():
            count += 1
        return count
    except Exception as e:
        logger.error(f"Error counting events for user {user_id}: {e}")
        raise


async def get_event_by_id(event_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches a single event document by id, or None if it does not exist.
    """
    try:
        db = get_db()
        doc_ref = db.collection("events").document(event_id)
        snapshot = await doc_ref.get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}
        data["id"] = snapshot.id
        return _normalize_timestamps(data)
    except Exception as e:
        logger.error(f"Error fetching event {event_id}: {e}")
        raise

