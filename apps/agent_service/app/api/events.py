import logging
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..models import Event, PaginatedEventsResponse, UpdateEventRequest
from ..services import firestore_service
from .auth import get_current_user

router = APIRouter(tags=["events"])

logger = logging.getLogger(__name__)


@router.get("/events", response_model=PaginatedEventsResponse)
async def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: Dict[str, Any] = Depends(get_current_user),
) -> PaginatedEventsResponse:
    """Return the authenticated user's events sorted by updated_at descending with basic pagination."""
    user_id = user["uid"]
    offset = (page - 1) * page_size

    try:
        events_data = await firestore_service.get_events_for_user(
            user_id=user_id, offset=offset, limit=page_size
        )
        total = await firestore_service.count_events_for_user(user_id=user_id)
    except Exception as e:
        logger.error(f"Failed to fetch events for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch events",
        )

    pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    items = [Event(**event) for event in events_data]

    return PaginatedEventsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.patch("/events/{event_id}", response_model=Event)
async def patch_event(
    event_id: str,
    payload: UpdateEventRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Event:
    """Partially update an existing event owned by the authenticated user."""
    user_id = user["uid"]

    try:
        existing = await firestore_service.get_event_by_id(event_id)
    except Exception as e:
        logger.error(f"Failed to fetch event {event_id} for patch: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load event",
        )

    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if existing.get("created_by") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this event",
        )

    update_data = {
        key: value
        for key, value in payload.dict(exclude_unset=True).items()
        if value is not None
    }

    # No fields to update – return current representation as a no-op.
    if not update_data:
        return Event(**existing)

    try:
        await firestore_service.update_event(event_id, update_data)
        updated = await firestore_service.get_event_by_id(event_id)
    except Exception as e:
        logger.error(f"Failed to update event {event_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update event",
        )

    if updated is None:
        logger.error(
            "Event %s was updated but could not be refetched afterwards.",
            event_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Updated event could not be loaded",
        )

    return Event(**updated)


@router.get("/events/{event_id}", response_model=Event)
async def get_event(
    event_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Event:
    """Fetch a single event by ID, ensuring the authenticated user owns it."""
    user_id = user["uid"]
    
    try:
        event_dict = await firestore_service.get_event_by_id(event_id)
    except Exception as e:
        logger.error(f"Failed to fetch event {event_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load event",
        )
        
    if not event_dict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
        
    if event_dict.get("created_by") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this event",
        )
        
    return Event(**event_dict)


@router.get("/events/{event_id}/media")
async def get_event_media(
    event_id: str,
    session_id: str = Query(None),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Fetch media assets associated with an event, optionally filtered by session_id."""
    user_id = user["uid"]
    
    try:
        event_dict = await firestore_service.get_event_by_id(event_id)
        if not event_dict or event_dict.get("created_by") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this event's media",
            )
            
        media = await firestore_service.get_media_for_event(event_id, session_id)
        return {"media_assets": media}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch media for event {event_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load media assets",
        )


@router.get("/events/{event_id}/session")
async def get_event_session(
    event_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Return the session_id associated with an event for the authenticated user."""
    user_id = user["uid"]

    try:
        event_dict = await firestore_service.get_event_by_id(event_id)
        if not event_dict or event_dict.get("created_by") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this event",
            )

        session_record = await firestore_service.get_session_by_event_id(event_id)
        if not session_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No session found for this event",
            )

        return {
            "session_id": session_record["session_id"],
            "user_id": session_record["user_id"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch session for event {event_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load session info",
        )

