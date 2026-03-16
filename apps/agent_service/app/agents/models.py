"""Shared Pydantic models for agent tool outputs.

All content-generation AgentTools (MultimodalContentCreator, VideoGenerator)
return a ContentToolResult so ContentGenerator can compose a cohesive final
message from structured, consistent data.
"""

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class MediaAsset(BaseModel):
    """Represents a single media asset (image/video) in a chat response."""
    asset_id: str = Field(description="Unique identifier from Firestore")
    url: str = Field(description="Public HTTPS URL of the asset")
    thumbnail_url: Optional[str] = Field(default=None, description="Optional thumbnail URL")
    asset_type: str = Field(description="'image' or 'video'")
    mime_type: str = Field(description="Standard MIME type (e.g. image/jpeg)")


class FinalResponseData(BaseModel):
    """The core text data of the final response."""
    text: str = Field(description="The primary markdown text content.")


class FinalResponse(BaseModel):
    """The top-level schema for events delivered to chat.py."""
    data: FinalResponseData
    media_assets: List[MediaAsset] = Field(
        default_factory=list, 
        description="List of all generated media objects."
    )


class ContentToolResult(BaseModel):
    """Standard output schema for all content-generation AgentTools.

    Attributes:
        status: 'success' or 'error'.
        data: Primary payload — text, image data, GCS URL, etc.
        metadata: Contextual info the ContentGenerator uses to write the
                  synthesised summary (content_type, format, notes, etc.).
    """

    status: str = Field(description="'success' or 'error'")
    data: Any = Field(
        description="Primary output: text copy, image bytes/URL, video GCS URL, etc."
    )
    metadata: dict = Field(
        default_factory=dict,
        description=(
            "Contextual info: content_type, formats_included, image_count, "
            "resolution, notes — used by ContentGenerator to compose the "
            "final synthesised message."
        ),
    )
