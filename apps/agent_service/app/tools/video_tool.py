import asyncio
from google import genai
from google.genai import types
from google.adk.tools import ToolContext
from ..config import settings
from app.utils.constants import VIDEO_DURATION_SECONDS, VEO_POLL_INTERVAL_SECONDS, VIDEO_ASPECT_RATIO, VIDEO_RESOLUTION
from app.services.firestore_service import save_media_asset, gs_to_public_url

import logging
logger = logging.getLogger(__name__)


async def generate_video_clip(
    prompt: str,
    tool_context: ToolContext,
    duration_seconds: int = VIDEO_DURATION_SECONDS,
) -> dict:
    """Generate a short event video teaser using Veo.

    Args:
        prompt: Cinematic description of the video to generate.
        tool_context: ADK ToolContext — provides session state for event_id / session_id.
        duration_seconds: Target clip length in seconds.

    Returns:
        ContentToolResult-shaped dict with GCS video URL and asset_id for chat.py.
    """
    # Pull event/session IDs from session state (set by chat.py when calling runner)
    state = tool_context.state or {}
    event_id = state.get("event_id", "unknown_event")
    session_id = state.get("session_id", "unknown_session")

    try:
        client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )

        # Start the video generation
        operation = client.models.generate_videos(
            model="veo-3.1-fast-generate-preview",
            prompt=prompt,
            config=types.GenerateVideoConfig(
                aspect_ratio=VIDEO_ASPECT_RATIO,
                person_generation="ALLOW_ADULT",
                # The trailing slash means the service will generate a filename
                output_gcs_uri=f"gs://{settings.gcs_bucket_name}/videos/{event_id}/{session_id}/",
            ),
        )

        # Poll until done
        while not operation.done:
            await asyncio.sleep(VEO_POLL_INTERVAL_SECONDS)
            operation = client.operations.get(operation)

        if operation.error:
            raise Exception(f"Veo API error: {operation.error}")

        if not operation.response or not operation.response.generated_videos:
            raise Exception("Veo API succeeded but returned no videos.")

        video_uri = operation.response.generated_videos[0].video.uri
        public_url = gs_to_public_url(video_uri)

        # Save to Firestore media_assets collection
        asset_id = await save_media_asset({
            "event_id": event_id,
            "session_id": session_id,
            "source": "agent_generated",
            "asset_type": "video",
            "subtype": None,
            "parent_asset_id": None,
            "gcs_path": video_uri,
            "public_url": public_url,
            "content_category": "video",
            "title": "Video Teaser",
            "mime_type": "video/mp4",
            "rich_content": None,
            "subject": None,
        })
        logger.info(f"Saved video asset_id={asset_id} uri={video_uri}")

        return {
            "status": "success",
            "data": public_url,
            "metadata": {
                "content_type": "video",
                "duration_seconds": duration_seconds,
                "resolution": VIDEO_RESOLUTION,
                "format": "MP4",
                "prompt_used": prompt,
            },
            # Injected for chat.py to build media_refs
            "media_assets": [{
                "asset_id": asset_id,
                "url": public_url,
                "thumbnail_url": None,  # Videos don't have a thumbnail yet
                "asset_type": "video",
                "mime_type": "video/mp4",
            }],
        }
    except Exception as exc:
        logger.error(f"Video generation failed: {exc}")
        return {
            "status": "error",
            "data": None,
            "metadata": {"error": str(exc), "note": "Video generation failed."},
        }

