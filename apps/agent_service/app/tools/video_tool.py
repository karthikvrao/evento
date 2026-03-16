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
            model="veo-3.1-fast-generate-001",
            prompt=prompt,
            config=types.GenerateVideosConfig(
                aspect_ratio=VIDEO_ASPECT_RATIO,
                number_of_videos=1,
                resolution=VIDEO_RESOLUTION,
                person_generation="allow_adult",
                enhance_prompt=True,
                generate_audio=True,
                # The trailing slash means the service will generate a filename
                output_gcs_uri=f"gs://{settings.gcs_bucket_name}/videos/{event_id}/{session_id}/",
            ),
        )

        # Poll until done (with a safety timeout)
        max_polls = 12  # 12 * 5s = 1 minute
        poll_count = 0
        
        while not operation.done and poll_count < max_polls:
            poll_count += 1
            await asyncio.sleep(VEO_POLL_INTERVAL_SECONDS)
            try:
                operation = client.operations.get(operation)
                logger.info(f"Veo polling {poll_count}/{max_polls}: done={operation.done}")
            except Exception as e:
                logger.warning(f"Veo poll failed (will retry): {e}")
                continue

        if not operation.done:
            logger.warning(f"Veo generation timed out after {poll_count} polls. Continuing in background.")
            video_uri = f"gs://{settings.gcs_bucket_name}/videos/{event_id}/{session_id}/video_0.mp4"
            return {
                "status": "pending",
                "data": gs_to_public_url(video_uri),
                "metadata": {
                    "note": (
                        "The video generation is taking a bit longer than usual. "
                        "It will continue processing in the background and should "
                        "appear in your event media gallery within the next few minutes."
                    ),
                    "poll_count": poll_count
                },
                "media_assets": []
            }

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

