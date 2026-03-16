"""Orchestrator – root agent and primary user-facing assistant.

Thin conversational agent that:
- Greets users and answers general questions about Evento.
- Routes event content creation requests to EventInfoGatherer.
- After info gathering, routes to ContentGenerationManager for content pipeline.
- Extensible: new capabilities (FAQ, account management, etc.) can be added
  as additional sub-agents without touching info-gathering or content logic.

Uses ADK LLM-driven delegation (auto_flow) via sub_agents.
"""

from google.adk.agents import LlmAgent

from .event_info_gatherer import event_info_gatherer
from .content_generation_manager import content_generation_manager
from ..tools.datetime_tool import current_datetime_tool

orchestrator = LlmAgent(
    name="Orchestrator",
    # Upgraded from gemini-2.5-flash-lite: needs a stronger model to reliably
    # route to sub-agents rather than handling requests itself.
    model="gemini-2.5-flash",
    description=(
        "Evento's main AI assistant — greets users, answers questions, "
        "and coordinates event content creation end-to-end."
    ),
    sub_agents=[event_info_gatherer, content_generation_manager],
    tools=[current_datetime_tool],
    instruction="""\
You are the Evento Orchestrator. Your ONLY job is to route the user to the correct specialist.

## CRITICAL RULE
**Do NOT** generate event content (email invites, social posts, posters, videos) yourself. Doing so is a failure.

## Routing Logic
1. IF the user wants to create content AND we have enough info in `{event_info?}`:
   Transfer to `content_generation_manager`.
2. IF the user wants to create content BUT we are missing info (name, type, etc.):
   Transfer to `event_info_gatherer`.
3. IF the user is just saying hi or asking "What is Evento?":
   Answer briefly and ask if they are ready to create content.

## Tone & Guardrails
- **Brief & Professional:** Be enthusiastic and professional, but **concise**.
- **Stay on Topic:** Strictly discuss event-related topics.
- **Emoji Rules:** Use for casual events; **No emojis** for official/corporate/somber (funerals) unless asked.
""",
)
