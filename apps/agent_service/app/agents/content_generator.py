"""ContentGenerator – fans out content creation to specialist AgentTools.

Receives the content plan + event info from session state, then calls
MultimodalContentCreator and/or VideoGenerator (all or a subset) based on
the user's requirements. Synthesises their ContentToolResult outputs into
a single cohesive, friendly response.
"""

from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool
from google.genai import types as genai_types

from .multimodal_content_creator import multimodal_content_creator
from .video_generator import video_generator
from .models import FinalResponse

content_generator = LlmAgent(
    name="ContentGenerator",
    # Upgraded from gemini-2.5-flash-lite: needs a stronger model to reliably
    # invoke AgentTools (MultimodalContentCreator, VideoGenerator) rather than
    # skipping them and returning text descriptions only.
    model="gemini-2.5-flash",
    description=(
        "Generates all requested content types by calling specialist tools "
        "simultaneously and synthesising their outputs."
    ),
    include_contents="none",
    # output_schema enforces strict JSON structure via Gemini's Controlled Generation.
    output_schema=FinalResponse,
    generate_content_config=genai_types.GenerateContentConfig(
        response_mime_type="application/json"
    ),
    tools=[
        AgentTool(agent=multimodal_content_creator),
        AgentTool(agent=video_generator),
    ],
    instruction="""\
You are a content production manager for event content creation.

## Context
- Event details: {event_info?}
- Research & content plan: {research_and_plan?}
- User instructions: {user_instructions?}

## CRITICAL RULE — Call MultimodalContentCreator ONCE with ALL content types
You MUST call `MultimodalContentCreator` exactly **once** with a prompt that
covers ALL requested content types (social post, email, poster, etc.) together.

**DO NOT** call it multiple times — one call per turn, with everything bundled.
Calling it more than once causes API rate-limit errors (429).

**Never write social posts, email copy, or describe what an image might look like.**
The tool generates real images — call it. Describing images yourself is a failure.

Available tools:
- **MultimodalContentCreator**: real images + text copy (social posts, emails,
  posters, banners). Call this **once** with all content requirements.
- **VideoGenerator**: a short 5-second event video teaser. Call this when the
  user requests video content or you judge it would add value.

When to call a subset:
- User asks "just a social post" → MultimodalContentCreator only.
- User asks "just a video" → VideoGenerator only.
- Default (unspecified) → call MultimodalContentCreator (all content) + VideoGenerator.

## Synthesising the response
After receiving all tool results, you MUST compose your response as a JSON object
with this EXACT structure (no extra markdown, no code fences — raw JSON only):

{
  "data": {
    "text": "<your interleaved prose summary as markdown>"
  },
  "media_assets": [<copy ALL media_assets from tool results here>]
}

For the "text" field, compose a friendly, well-structured markdown message:
1. Open with a brief line about what was created.
2. Present each piece of content clearly (use headers per content type).
3. For **emails**, ensure you include a clear **Subject Line** and a full **Body**.
4. Include the written copy (email body, social post caption, etc.) from the tool results.
5. **DO NOT** describe or invent image descriptions or add your own content copy.
6. Apply Tone & Emoji rules: Concise & Professional; emojis for casual, none for official/somber/funerals unless asked.
7. **Stay strictly on topic.** No general chat or tangential advice.
8. If a tool result has `status: "pending"`, do NOT include its `media_assets` yet. Instead, add a polite note in the "text" field telling the user that the content (e.g. your video) is still processing and will be visible in the event gallery in about a minute.
9. Mention any other notes the user should know and offer to refine.

For the "media_assets" field, copy the `media_assets` array from each tool result (only where `status` is "success") EXACTLY as-is.
""",
)
