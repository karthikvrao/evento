# Agent UX & Code Improvements

## Code Review Findings

### [chat.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/chat.py) init_chat (L28-42) — ✅ Looks good
The event_id pre-generation and seeding into ADK state is correct. One small issue: the initial event data (`name`, `description`, `event_type`) is **not** being seeded into session state. This means the agent starts with a blank slate on first message, even though we already know event details from the creation form.

### [firestore_service.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/services/firestore_service.py) (L39-49) — ✅ Looks good
The optional [event_id](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/services/firestore_service.py#161-176) param is clean and backwards-compatible.

### 429 Frontend Handling — **Needs fix**
Currently the backend sends `{type: "message", author: "System", text: "Oops!..."}`. This shows as a regular chat message. Should instead send `{type: "error"}` so the frontend can render a non-intrusive toast/banner rather than polluting the conversation.

---

## Proposed Changes

### 1. Error Messages as Toast, Not Chat

#### [MODIFY] [chat.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/chat.py)
- Change the catch block to send `{type: "error", text: "..."}` instead of `{type: "message"}`

#### [MODIFY] [chat.ts](file:///Volumes/Jaaga1/repos/evento/apps/web/src/types/chat.ts)
- Add `'error'` to the `WsAgentMessage.type` union

#### [MODIFY] [useEventSession.ts](file:///Volumes/Jaaga1/repos/evento/apps/web/src/hooks/useEventSession.ts)
- Handle `type: 'error'` — clear thinking state, show a toast/banner, do NOT append to chat messages

---

### 2. Seed Initial Event Data into Session State

#### [MODIFY] [chat.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/chat.py) — [init_chat](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/chat.py#22-62)
- Seed `event_info: {event_name, description, event_type}` from the [InitChatRequest](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/models/chat.py#5-9) payload into the ADK session's initial state, so the Orchestrator/EventInfoGatherer already know the event name on first turn

#### [MODIFY] [chat.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/chat.py) — [chat_ws](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/chat.py#134-318)
- On WS connect, load event data from Firestore into session state if [event_info](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/event_info_gatherer.py#16-95) is empty (handles page refreshes / reconnects)

---

### 3. `current_datetime` Tool for Orchestrator

#### [NEW] [datetime_tool.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/tools/datetime_tool.py)
- Simple `FunctionTool` returning current UTC and local datetime + timezone info
- Allows agents to resolve relative dates like "next Friday" or "in 2 weeks"

#### [MODIFY] [orchestrator.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/orchestrator.py)
- Add `get_current_datetime` to `tools` list

---

### 4. Agent Instruction Rewrites

All agents get instruction updates. **No structural/code changes** — only the `instruction` string.

#### [MODIFY] [orchestrator.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/orchestrator.py)
- Reference [event_info](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/event_info_gatherer.py#16-95) in context so it greets the user knowing the event name
- Add emoji rules (use for casual events, skip for funerals/official)
- Add guardrail: stay on-topic, decline off-topic requests politely
- Concise, warm tone — no walls of text

#### [MODIFY] [event_info_gatherer.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/event_info_gatherer.py)
- **Critical fix**: Never dump a form. Ask natural questions, 1-2 at a time
- Derive field values from conversational answers — don't demand structured input
- Acknowledge what's already known from [event_info](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/event_info_gatherer.py#16-95) state (name, type, description)
- Before handing off: summarise what you've gathered and ask user to confirm
- Offer content type choices: "Would you like social posts, email invites, posters, or all of the above?"
- Emoji rules (match event tone)
- Guardrail: stay on topic

#### [MODIFY] [content_generation_manager.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/content_generation_manager.py)
- Add concise/friendly tone and stay-on-topic guardrail

#### [MODIFY] [multimodal_content_creator.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/multimodal_content_creator.py)
- Email content must include **subject line** and **body** (currently only says "email body")
- Add emoji and tone rules

#### [MODIFY] [content_generator.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/content_generator.py)
- Email JSON structure should include `subject` field
- Add tone/emoji rules

---

## Verification Plan

### Manual Testing
1. Create a new event with name + description → first agent message should reference the event name
2. Give short / vague responses → agent should ask friendly follow-up questions, not dump a form
3. Check that 429 errors show as a dismissible banner, not a chat bubble
4. Test with "funeral" event type → verify no emojis in response
5. Test with "birthday party" → verify appropriate emojis
6. Ask off-topic question → verify agent politely redirects
7. Request email content → verify output has both subject line and body
