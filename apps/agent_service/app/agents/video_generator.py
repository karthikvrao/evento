"""VideoGenerator – short event video via Veo (stub in Phase 1).

In Phase 1 the generate_video_clip function is a stub that returns a
placeholder. Phase 3 replaces this with a real Veo API call that uploads
the result to GCS.

Wrapped in a thin LlmAgent so ContentGenerator can call it as an AgentTool
and receive a standard ContentToolResult-shaped response.
"""

from google.adk.agents import LlmAgent
from app.tools.video_tool import generate_video_clip


video_generator = LlmAgent(
    name="VideoGenerator",
    model="gemini-2.5-flash",
    description=(
        "Generates a short event video teaser using Vertex AI Veo "
        "and uploads it to GCS."
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
Call generate_video_clip with a vivid, cinematic prompt for a short
event teaser. Capture the event's energy, highlight key themes, and
make it feel exciting and professional.

Return the tool result directly as your final response — do not add extra text.
""",
)
