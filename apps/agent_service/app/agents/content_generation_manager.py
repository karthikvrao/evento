"""ContentGenerationManager – decides the content pipeline and drives it.

An LlmAgent (not a SequentialAgent) so it can:
- Decide whether to call ResearchAndPlanner first or skip straight to
  ContentGenerator (e.g. for targeted edits or quick turnarounds).
- Handle follow-up user requests (edits, regeneration) after content is
  delivered, without needing a new top-level invocation.

ResearchAndPlanner and ContentGenerator are both AgentTools.
"""

from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool

from .research_and_planner import research_and_planner
from .content_generator import content_generator

content_generation_manager = LlmAgent(
    name="ContentGenerationManager",
    model="gemini-2.5-flash",
    description=(
        "Manages the content creation pipeline. Decides whether to run "
        "research and planning before generating content, or to call "
        "ContentGenerator directly for targeted requests."
    ),
    instruction="""\
You are the content production lead for Evento.

## Context available in state
- Event details: {event_info}
- User instructions: {user_instructions?}
- Previous research & plan (if already run): {research_and_plan?}

## Pipeline decision

**Call ResearchAndPlanner FIRST when:**
- This is a fresh content campaign or a new event
- The user hasn't given specific creative direction
- There is no existing research_and_plan in state
- There is major change in event info or user specifies major change in creative direction

**Skip to ContentGenerator directly when:**
- The user requests targeted edits ("make it shorter", "change the tone")
- The user explicitly says "skip research" or "just generate"
- A research_and_plan already exists in state and the request is incremental

## After content is delivered
Present ContentGenerator's synthesised output clearly and warmly.
Always offer to refine, adjust, or regenerate any piece of content.
""",
    tools=[
        AgentTool(agent=research_and_planner),
        AgentTool(agent=content_generator),
    ],
)
