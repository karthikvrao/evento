import asyncio
from google import genai
from google.genai import types
from ..config import settings
from app.utils.constants import VIDEO_DURATION_SECONDS, VEO_POLL_INTERVAL_SECONDS, VIDEO_ASPECT_RATIO, VIDEO_RESOLUTION

async def generate_video_clip(prompt: str, duration_seconds: int = VIDEO_DURATION_SECONDS) -> dict:
    """Generate a short event video teaser using Veo.

    Args:
        prompt: Cinematic description of the video to generate.
        duration_seconds: Target clip length in seconds.

    Returns:
        ContentToolResult-shaped dict with the generated GCS video URL.
    """
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
                output_gcs_uri=f"gs://{settings.gcs_bucket_name}/videos/", 
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

        return {
            "status": "success",
            "data": video_uri,
            "metadata": {
                "content_type": "video",
                "duration_seconds": duration_seconds,
                "resolution": VIDEO_RESOLUTION,
                "format": "MP4",
                "prompt_used": prompt,
            },
        }
    except Exception as exc:
        return {
            "status": "error",
            "data": None,
            "metadata": {"error": str(exc), "note": "Video generation failed."},
        }
