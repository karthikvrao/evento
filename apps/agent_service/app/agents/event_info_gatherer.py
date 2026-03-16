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
from ..tools.datetime_tool import current_datetime_tool


def _split_list(value: str) -> list[str]:
    """Split a comma-separated string into a cleaned list of strings.

    Returns an empty list if the value is blank, so we never overwrite existing
    list fields with an empty list.
    """
    return [item.strip() for item in value.split(",") if item.strip()]


async def save_event_info(
    tool_context: ToolContext,
    # ── Top-level Event fields ────────────────────────────────────────────────
    name: str = "",
    description: str = "",
    start_time: str = "",   # human-readable, e.g. "Sep 15 2025 9:00 AM IST"
    end_time: str = "",
    # ── EventMetadata fields ──────────────────────────────────────────────────
    event_type: str = "",              # Category: Conference, Meetup, Workshop…
    mode: str = "",                    # Delivery: Online, Offline, or Hybrid
    location: str = "",                # Venue name, city, or online platform
    target_audience: str = "",         # Who the event is for
    key_highlights: str = "",          # Comma-separated: "Keynotes, workshops"
    speakers: str = "",                # Comma-separated: "Alice, Bob"
    agenda_items: str = "",            # Comma-separated: "Intro, Panel, Q&A"
    hosts: str = "",                   # Comma-separated: "Org A, Org B"
    tagline: str = "",                 # Short punchy phrase for the event
    theme: str = "",                   # Visual/tonal theme: Formal, Vibrant…
    contact_info: str = "",            # Email, website, or phone for enquiries
    specific_content_types: str = "",  # Comma-separated: "poster, email, video"
    # ── Session-level ─────────────────────────────────────────────────────────
    user_instructions: str = "",       # Special branding or creative direction
) -> dict:
    """Save collected event information to session state incrementally.

    Call this as the user provides details — you don't need all fields at once.
    Each call deep-merges new non-empty values into existing state so previously
    saved fields are preserved.

    For list-type fields (key_highlights, speakers, agenda_items, hosts,
    specific_content_types) pass a comma-separated string, e.g.
    "Alice, Bob" → stored as ["Alice", "Bob"].

    Args:
        tool_context: Injected by ADK — used to write to session state.
        name: Name / title of the event.
        description: Brief overview of the event and its purpose.
        start_time: When the event starts (date, time, timezone).
        end_time: When the event ends (date, time, timezone).
        event_type: Category of event — Conference, Meetup, Workshop, Concert, etc.
        mode: Delivery format — Online, Offline, or Hybrid.
        location: Venue name, city, or online platform URL.
        target_audience: Who the event is for (role, industry, interests).
        key_highlights: Main attractions or agenda items (comma-separated).
        speakers: Speaker names (comma-separated).
        agenda_items: Agenda line items (comma-separated).
        hosts: Hosting organisation(s) or person(s) (comma-separated).
        tagline: Short punchy phrase that captures the event spirit.
        theme: Visual or tonal theme, e.g. Formal, Fun, Futuristic.
        contact_info: Email, website, or phone for enquiries.
        specific_content_types: Content types requested (comma-separated), e.g.
            "social post, email invite, poster, video teaser".
        user_instructions: Special tone, branding, or creative direction that
            applies to ALL generated content.

    Returns:
        Confirmation dict listing which fields were updated.
    """
    try:
        # ── Build top-level scalar updates ────────────────────────────────────
        top_level_updates = {
            k: v
            for k, v in {
                "name": name,
                "description": description,
                "start_time": start_time,
                "end_time": end_time,
            }.items()
            if v
        }

        # ── Build metadata updates (list fields split from comma strings) ──────
        meta_updates: dict = {}
        for field, value in {
            "event_type": event_type,
            "mode": mode,
            "location": location,
            "target_audience": target_audience,
            "tagline": tagline,
            "theme": theme,
            "contact_info": contact_info,
        }.items():
            if value:
                meta_updates[field] = value

        for list_field, value in {
            "key_highlights": key_highlights,
            "speakers": speakers,
            "agenda_items": agenda_items,
            "hosts": hosts,
            "specific_content_types": specific_content_types,
        }.items():
            if value:
                meta_updates[list_field] = _split_list(value)

        # ── Deep-merge into existing event_info state ─────────────────────────
        existing = tool_context.state.get("event_info", {})
        existing_meta = existing.get("metadata", {})

        # Merge metadata (existing values preserved unless explicitly overwritten)
        merged_meta = {**existing_meta, **meta_updates}

        updated_event_info = {
            **existing,
            **top_level_updates,
        }
        if merged_meta:
            updated_event_info["metadata"] = merged_meta

        tool_context.state["event_info"] = updated_event_info

        # Store user instructions separately so every downstream agent sees them.
        if user_instructions:
            tool_context.state["user_instructions"] = user_instructions

        # ── Track which fields were saved for the confirmation message ─────────
        saved_fields = list(top_level_updates.keys()) + list(meta_updates.keys())
        if user_instructions:
            saved_fields.append("user_instructions")

        # ── Database Persistence ───────────────────────────────────────────────
        event_id = tool_context.state.get("event_id")
        if not event_id:
            return {"status": "error", "error": "No event_id found in session state"}

        # Build the payload for Firestore — same nested shape as event_info.
        firestore_payload = dict(updated_event_info)
        if user_instructions:
            firestore_payload["user_instructions"] = user_instructions

        await firestore_service.update_event(event_id, firestore_payload)

        return {
            "status": "saved",
            "fields_updated": saved_fields,
            "event_id": event_id,
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


event_info_gatherer = LlmAgent(
    name="EventInfoGatherer",
    # Upgraded from gemini-2.5-flash-lite: needs a stronger model to reliably
    # call save_event_info tool rather than just responding with text.
    model="gemini-2.5-flash",
    description=(
        "Gathers event details from the user through friendly multi-turn "
        "conversation and saves them to session state."
    ),
    tools=[save_event_info, current_datetime_tool],
    instruction="""\
You are Evento's event information specialist.
Your goal is to gather details in a friendly, conversational way to prepare for content generation.

## Context available in state
- Current event info: {event_info?}
- User instructions: {user_instructions?}

## Your Strategy
1. **Acknowledge & Flow:** Start by acknowledging what we already know from `{event_info?}` (e.g. the event name). Don't ask for things already provided.
2. **Be Conversational:** Never dump a list of fields or a form. Ask **1–2 friendly questions** at a time.
3. **Offer Choices:** Specifically ask what type of content they want (e.g., "Would you like social media posts, email invites, professional posters, or a video teaser? Or all of the above?").
4. **Derive, Don't Demand:** Allow the user to answer naturally. Use your tools to save what you can derive from their prose.
5. **Resolve Dates:** Use `get_current_datetime` tool if the user gives relative dates like "next Saturday".

## Field mapping — so you know what to capture where
All fields go into `save_event_info`. Here's what each means:
- `name` — the event title.
- `description` — brief overview / purpose.
- `event_type` — category: Conference, Meetup, Workshop, Concert, Exhibition, etc.
- `mode` — delivery format: **Online**, **Offline**, or **Hybrid**.
- `start_time` / `end_time` — when it starts and ends (date + time + timezone).
- `location` — venue name, city, or online platform.
- `target_audience` — who it's for.
- `key_highlights` — comma-separated main attractions, e.g. "Keynotes, hackathon, networking".
- `speakers` — comma-separated speaker names, e.g. "Alice Zhao, Bob Smith".
- `agenda_items` — comma-separated agenda line items.
- `hosts` — comma-separated hosting orgs or people.
- `tagline` — a punchy short phrase that captures the event spirit.
- `theme` — visual/tonal theme, e.g. Formal, Futuristic, Retro.
- `contact_info` — email or website for enquiries.
- `specific_content_types` — comma-separated content types: "social post, email invite, poster, video teaser".
- `user_instructions` — any special tone, branding, or creative direction that applies to ALL content.

## Required info at minimum
- Event Name, Type, Mode, Start and End Date/Time, and Target Audience.
- Ask about Key Highlights or Speakers if not already known.

## Hand-off Protocol
- When you have enough info OR the user says "go ahead/skip/ready":
  1. Briefly summarize what you've gathered.
  2. Ask: "Does this look right? Ready to generate your content?"
  3. Once they confirm, say "Great! Handing over to my creative side now." and stop.

## Tone & Guardrails
- **Warm & Concise:** Be supportive but brief. No long-winded chat.
- **Emoji Rules:** Use for casual events; skip for official/somber (funerals) unless asked expressly.
- **Stay on Topic:** Only discuss this event and its content preparation.
""",
)
