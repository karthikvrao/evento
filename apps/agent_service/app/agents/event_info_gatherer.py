"""EventInfoGatherer – multi-turn event information collection.

Engages the user in friendly conversation to gather the event details needed
for content generation. Saves data incrementally to session state via the
save_event_info FunctionTool so nothing is lost if the conversation is long.

Transfers control back to Orchestrator (which routes to ContentGenerationManager)
once enough info is collected or the user asks to proceed.
"""

from google.adk.agents import LlmAgent
from google.adk.tools import ToolContext
from ..services import firestore_service


async def save_event_info(
    tool_context: ToolContext,
    event_name: str = "",
    event_type: str = "",
    date_and_time: str = "",
    location: str = "",
    target_audience: str = "",
    key_highlights: str = "",
    content_types_requested: str = "",
    user_instructions: str = "",
) -> dict:
    """Save collected event information to session state incrementally.

    Call this as the user provides details — you don't need all fields at once.
    Each call merges new values into existing state; previously saved fields
    are preserved.

    Args:
        tool_context: Injected by ADK — used to write to session state.
        event_name: Name / title of the event.
        event_type: 'online', 'offline', or 'hybrid'.
        date_and_time: When the event is held (date, time, timezone).
        location: Venue name, city, or online platform.
        target_audience: Who the event is for (role, industry, interests).
        key_highlights: Main attractions, speakers, agenda, or unique features.
        content_types_requested: Content the user wants, e.g. 'social post, email, video'.
        user_instructions: Any special tone, branding, or creative direction.

    Returns:
        Confirmation dict listing which fields were saved.
    """
    try:
        # Build dict of non-empty values provided in this call.
        updates = {
            k: v
            for k, v in {
                "event_name": event_name,
                "event_type": event_type,
                "date_and_time": date_and_time,
                "location": location,
                "target_audience": target_audience,
                "key_highlights": key_highlights,
                "content_types_requested": content_types_requested,
            }.items()
            if v
        }

        # Merge into existing event_info state (don't overwrite prior fields).
        existing = tool_context.state.get("event_info", {})
        tool_context.state["event_info"] = {**existing, **updates}

        # Store user instructions separately so all agents can read them.
        if user_instructions:
            tool_context.state["user_instructions"] = user_instructions

        saved_fields = list(updates.keys())
        if user_instructions:
            saved_fields.append("user_instructions")

        # ── Database Persistence ──
        event_id = tool_context.state.get("event_id")
        
        event_data = tool_context.state["event_info"].copy()
        if "user_instructions" in tool_context.state:
            event_data["user_instructions"] = tool_context.state["user_instructions"]

        if event_id:
            # Update existing event draft created during /chat/init
            await firestore_service.update_event(event_id, event_data)
        else:
            return {"status": "error", "error": "No event_id found in session state"}

        return {
            "status": "saved", 
            "fields_updated": saved_fields, 
            "event_id": event_id
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


event_info_gatherer = LlmAgent(
    name="EventInfoGatherer",
    model="gemini-2.5-flash",
    description=(
        "Gathers event details from the user through friendly multi-turn "
        "conversation and saves them to session state."
    ),
    tools=[save_event_info],
    instruction="""\
You are Evento's event information specialist.

## Your goal
Collect enough information about the user's event to generate great marketing
content. You need **at minimum**:
- Event name
- Online / offline / hybrid
- Date and approximate time
- Target audience

**Nice to have** (ask if not volunteered):
- Key highlights, speakers, or agenda items
- Specific content types they want (social posts, email, video teaser, banner…)
- Any special tone, branding notes, or creative direction

## Rules
- Ask **1–2 questions at a time**, not all at once. Be conversational.
- Be warm, encouraging, and enthusiastic about their event.
- **Call save_event_info incrementally** as the user provides details — do not
  wait until the end. Each call safely merges new fields without overwriting
  what was already saved.
- If the user says "skip", "continue", "that's enough", or "just go ahead",
  call save_event_info with whatever you have, confirm you're handing off, then
  end your turn so Orchestrator can route to ContentGenerationManager.
- Once you have the minimum required fields OR the user says skip, respond with
  a brief confirmation ("Great, I have enough to get started!") and stop — do
  not start generating content yourself.
""",
)
