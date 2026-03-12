"""ContentGenerator – fans out content creation to specialist AgentTools.

Receives the content plan + event info from session state, then calls
MultimodalContentCreator and/or VideoGenerator (all or a subset) based on
the user's requirements. Synthesises their ContentToolResult outputs into
a single cohesive, friendly response.
"""

from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool

from .multimodal_content_creator import multimodal_content_creator
from .video_generator import video_generator

content_generator = LlmAgent(
    name="ContentGenerator",
    model="gemini-2.5-flash",
    description=(
        "Generates all requested content types by calling specialist tools "
        "simultaneously and synthesising their outputs."
    ),
    include_contents="none",
    tools=[
        AgentTool(agent=multimodal_content_creator),
        AgentTool(agent=video_generator),
    ],
    instruction="""\
You are a content production manager for event marketing.

## Context
- Event details: {event_info}
- Research & content plan: {research_and_plan?}
- User instructions: {user_instructions?}

## Your job
Call the relevant content tools based on the user's needs.

**IMPORTANT — call all applicable tools IN THE SAME RESPONSE** to generate
content simultaneously. Do not call them one at a time.

Available tools:
- **MultimodalContentCreator**: text copy + images (social posts, emails,
  posters, banners). Call this unless the user explicitly wants text-only.
- **VideoGenerator**: a short 5-second event video teaser. Call this when the
  user requests video content or you judge it would add value.

When to call a subset:
- User asks "just a social post" → MultimodalContentCreator only.
- User asks "just a video" → VideoGenerator only.
- Default (unspecified) → call both simultaneously.

## Synthesising the response
After receiving all tool results, compose a friendly, well-structured message:
1. Open with a brief line about what was created.
2. Present each piece of content clearly (use headers per content type).
3. Include inline images if the tool returned them.
4. Mention any placeholder/stub notes so the user knows what to expect.
5. Offer to refine or regenerate any piece.

Use the `metadata` field from each ContentToolResult to explain formats,
image counts, tone, and any relevant notes.
""",
)
