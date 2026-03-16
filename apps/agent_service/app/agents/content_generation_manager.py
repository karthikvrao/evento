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
from google.genai import types as genai_types

from .research_and_planner import research_and_planner
from .content_generator import content_generator
from .models import FinalResponse

content_generation_manager = LlmAgent(
    name="ContentGenerationManager",
    # Upgraded from gemini-2.5-flash-lite: needs a stronger model to reliably
    # invoke tool calls rather than generating content text directly.
    model="gemini-2.5-flash",
    description=(
        "Manages the content creation pipeline. Decides whether to run "
        "research and planning before generating content, or to call "
        "ContentGenerator directly for targeted requests."
    ),
    # output_schema enforces strict JSON structure via Gemini's Controlled Generation.
    output_schema=FinalResponse,
    generate_content_config=genai_types.GenerateContentConfig(
        response_mime_type="application/json"
    ),
    # Prevent the agent from escalating back to the Orchestrator unexpectedly.
    disallow_transfer_to_parent=True,
    instruction="""\
You are a content production coordinator. You have TWO tools: ResearchAndPlanner and ContentGenerator.

## Step 1 — Research (conditional)
Call `ResearchAndPlanner` ONLY if `research_and_plan` is currently empty or missing from the state.

## Step 2 — Generate (MANDATORY)
Always call `ContentGenerator` with the full user request. You MUST NOT write event content (emails, posts, etc.) yourself.

## Step 3 — Return result
Return the `ContentGenerator` result VERBATIM. Do not rephrase, summarize, or add extra text.
""",
    tools=[
        AgentTool(agent=research_and_planner),
        AgentTool(agent=content_generator),
    ],
)
