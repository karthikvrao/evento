"""Shared Pydantic models for agent tool outputs.

All content-generation AgentTools (MultimodalContentCreator, VideoGenerator)
return a ContentToolResult so ContentGenerator can compose a cohesive final
message from structured, consistent data.
"""

from typing import Any
from pydantic import BaseModel, Field


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
