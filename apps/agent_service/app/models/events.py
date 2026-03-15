from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class EventMetadata(BaseModel):
    target_audience: Optional[str] = None
    key_highlights: Optional[List[str]] = None
    speakers: Optional[List[str]] = None
    agenda_items: Optional[List[str]] = None
    location: Optional[str] = None
    contact_info: Optional[str] = None
    theme: Optional[str] = None  # e.g. Formal, informal, fun, funeral
    specific_title: Optional[str] = None
    tagline: Optional[str] = None
    logo_urls: Optional[Dict[str, str]] = None
    hosts: Optional[List[str]] = None
    specific_content_types: Optional[List[str]] = None
    event_type: Optional[str] = None  # e.g. Conference, Meetup, Workshop, ...
    mode: Optional[str] = None  # e.g. Online, Offline, Hybrid


class Event(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    status: Optional[str] = None
    metadata: Optional[EventMetadata] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PaginatedEventsResponse(BaseModel):
    items: List[Event]
    total: int
    page: int
    page_size: int
    pages: int


class UpdateEventRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    status: Optional[str] = None
    metadata: Optional[EventMetadata] = None

