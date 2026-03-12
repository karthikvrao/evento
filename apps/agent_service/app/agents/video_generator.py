"""VideoGenerator – short event video via Veo (stub in Phase 1).

In Phase 1 the generate_video_clip function is a stub that returns a
placeholder. Phase 3 replaces this with a real Veo API call that uploads
the result to GCS.

Wrapped in a thin LlmAgent so ContentGenerator can call it as an AgentTool
and receive a standard ContentToolResult-shaped response.
"""

from google.adk.agents import LlmAgent


def generate_video_clip(prompt: str, duration_seconds: int = 5) -> dict:
    """Generate a short event video teaser (Phase 1 stub).

    Args:
        prompt: Cinematic description of the 5-second video to generate.
        duration_seconds: Target clip length in seconds (default 5, 1080p).

    Returns:
        ContentToolResult-shaped dict with a placeholder video URL.

    TODO (Phase 3): Replace stub body with real Veo API call:
        client.models.generate_videos(model='veo-3.1-fast-generate-preview', ...)
        Poll operation, upload to GCS, return GCS URI in data.
    """
    try:
        # ── Phase 1 stub ──────────────────────────────────────────────────────
        return {
            "status": "success",
            "data": "https://placehold.co/placeholder-video.mp4",
            "metadata": {
                "content_type": "video",
                "duration_seconds": duration_seconds,
                "resolution": "1080p",
                "format": "MP4",
                "prompt_used": prompt,
                "note": "Stub – Veo API integration wired in Phase 3.",
            },
        }
        # ── End stub ──────────────────────────────────────────────────────────
    except Exception as exc:
        return {
            "status": "error",
            "data": None,
            "metadata": {"error": str(exc), "note": "Video generation failed."},
        }


video_generator = LlmAgent(
    name="VideoGenerator",
    model="gemini-2.5-flash",
    description=(
        "Generates a short 5-second 1080p event video teaser using Veo "
        "and uploads it to GCS. (Phase 1: returns stub placeholder.)"
    ),
    include_contents="none",
    tools=[generate_video_clip],
    instruction="""\
You are an event video producer.

## Context
- Event details: {event_info}
- Research & content plan: {research_and_plan?}
- User instructions: {user_instructions?}

## Your job
Call generate_video_clip with a vivid, cinematic prompt for a 5-second
1080p event teaser. Capture the event's energy, highlight key themes, and
make it feel exciting and professional.

Return the tool result directly as your final response — do not add extra text.
""",
)
