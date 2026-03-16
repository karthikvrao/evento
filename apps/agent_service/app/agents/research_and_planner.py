"""ResearchAndPlanner – trend research + content planning in one agent.

Uses BuiltInPlanner (Gemini thinking) + Google Search grounding to:
  1. Research current trends relevant to the event.
  2. Produce an actionable content plan from that research.

Output saved to session state key 'research_and_plan' for use by
ContentGenerator → MultimodalContentCreator / VideoGenerator.
"""

from google.adk.agents import LlmAgent
from google.adk.planners import BuiltInPlanner
from google.genai import types

from google.adk.tools.google_search_tool import GoogleSearchTool
from ..tools.datetime_tool import current_datetime_tool

research_and_planner = LlmAgent(
    name="ResearchAndPlanner",
    # Thinking model recommended for BuiltInPlanner; falls back to Flash if Pro unavailable.
    model="gemini-2.5-flash",
    description=(
        "Researches current trends for the event domain and produces an "
        "actionable content plan that guides content creation."
    ),
    include_contents="none",
    planner=BuiltInPlanner(
        thinking_config=types.ThinkingConfig(
            # Keep thoughts internal — only the final plan surfaces to state.
            include_thoughts=False,
            thinking_budget=1024,
        )
    ),
    # Gemini normally rejects mixing search tools with FunctionTools.
    # We use the native ADK workaround `bypass_multi_tools_limit=True` to allow it.
    tools=[
        GoogleSearchTool(bypass_multi_tools_limit=True),
        current_datetime_tool
    ],
    instruction="""\
You are a senior event content strategist with deep research skills.

## Context
- Event details: {event_info?}
- User instructions: {user_instructions?}
- Current time: Use `get_current_datetime` tool to resolve relative dates or understand timeliness.

## Step 1 — Research
Use google_search to find:
- Current trends in the event's domain and audience segment
- Cultural moments, timely hooks, or news hooks
- Similar events and how they reached their audience
- Platform-specific content performance trends (Instagram, LinkedIn, email, etc.)

## Step 2 — Content Plan
Based on your research, produce a structured content plan:

1. **Key messages & themes** (3–5 bullet points)
2. **Recommended content formats** with rationale
   (e.g. "Instagram carousel – high engagement for tech events")
3. **Tone & style guidelines** (professional, energetic, witty…)
4. **Priority order** for content creation and why

Be concise and action-oriented. The plan is read directly by content creators,
not a human strategist.
""",
    output_key="research_and_plan",
)
