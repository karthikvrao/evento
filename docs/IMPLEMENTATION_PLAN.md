# Evento Agent Service – Phased Implementation Plan (v4)

**Goal:** Re-platform `apps/agent-service` as a full FastAPI app with ADK
multi-agent pipeline, Firebase Auth (Google login), WebSocket streaming,
VertexAi session persistence, and GCS media storage. Deploy to Cloud Run.

---

## Cross-Cutting Decisions

### Auth: Firebase Admin SDK + Google Sign-In only
Frontend uses Firebase Auth (Google provider only). Backend verifies the
Firebase ID token with `firebase-admin`. No Authlib needed.

### Runner + SessionService: module-level singletons
Per the [bidi-demo reference](https://github.com/google/adk-samples/blob/31847c0723fbf16ddf6eed411eb070d1c76afd1a/python/agents/bidi-demo/app/main.py),
`session_service` and `runner` are created once at startup (module level),
not per-request.

### Session: get-or-create + Firestore index
Per [ADK recommended pattern](https://google.github.io/adk-docs/streaming/dev-guide/part1/#recommended-pattern-get-or-create),
each WS connection calls `get_session` first, falls back to `create_session`.
A Firestore collection (`/sessions/{userId}/events/{eventId}`) stores
`session_id` so sessions can be resumed across browser refreshes.

### Local dev: `adk web` still works
`agent.py` keeps `root_agent = orchestrator`. Running `adk web` from
`apps/agent-service/` still starts the ADK dev UI with the full agent tree —
no auth or FastAPI needed for local agent testing.

### Local vs Cloud session service
`SESSION_SERVICE=memory` (default) uses `InMemorySessionService`.
`SESSION_SERVICE=vertexai` uses `VertexAiSessionService`. Controlled via env var.

### Naming
| Old name | New name | Reason |
|---|---|---|
| `ContentCreator` | `MultimodalContentCreator` | Distinguishes from generic "creator" |
| `content_creator.py` | `multimodal_content_creator.py` | Matches class rename |

---

## Phase 1 — Agent Architecture Core

**Goal:** Replace the old pipeline with the new agent tree. Testable with `adk web`.

### Files

| Action | File |
|--------|------|
| MODIFY | `agents/orchestrator.py` |
| NEW | `agents/event_info_gatherer.py` |
| NEW | `agents/content_generation_manager.py` |
| NEW | `agents/research_and_planner.py` |
| NEW | `agents/content_generator.py` |
| NEW | `agents/multimodal_content_creator.py` |
| NEW | `agents/video_generator.py` (stub, real Veo in Phase 3) |
| NEW | `agents/models.py` (`ContentToolResult` Pydantic model) |
| DELETE | `agents/pipeline.py` |
| DELETE | `agents/visual_designer.py` |
| DELETE | `agents/trend_analyst.py` |
| DELETE | `agents/creative_writer.py` |
| MODIFY | `agents/__init__.py` |
| MODIFY | `agent.py` |
| MODIFY | `tools/__init__.py` |

### Agent tree

```
Orchestrator (LlmAgent, root)
├── sub_agents:
│   ├── EventInfoGatherer      (LlmAgent)
│   └── ContentGenerationManager (LlmAgent)
│       └── tools (AgentTools):
│           ├── ResearchAndPlanner  (LlmAgent + BuiltInPlanner + google_search)
│           └── ContentGenerator   (LlmAgent)
│               └── tools (AgentTools):
│                   ├── MultimodalContentCreator (LlmAgent, gemini-2.0-flash-preview-image-generation)
│                   └── VideoGenerator (LlmAgent wrapping Veo FunctionTool stub)
```

### Key implementation notes

**`agents/models.py`**
```python
from pydantic import BaseModel, Field
from typing import Any

class ContentToolResult(BaseModel):
    status: str = Field(description="'success' or 'error'")
    data: Any = Field(description="Primary payload: text, GCS URL, etc.")
    metadata: dict = Field(default_factory=dict,
        description="content_type, format, notes, etc. — used by ContentGenerator to compose final message")
```

**`agents/multimodal_content_creator.py`**
```python
multimodal_content_creator = LlmAgent(
    name="MultimodalContentCreator",
    model="gemini-2.0-flash-preview-image-generation",
    # ← produces interleaved text + inline images in a single response
    description="Generates event marketing copy with embedded images (social posts, emails, posters).",
    include_contents='none',
    instruction="""...""",  # reads {event_info}, {research_and_plan?}, {user_instructions?}
)
```

> **Model note:** `gemini-2.0-flash-preview-image-generation` is the confirmed
> GA model name. Update to `gemini-3.1-flash-image-preview` if/when available.

**`agents/video_generator.py` (Phase 1 stub)**
```python
def _stub_generate_video(prompt: str, duration_seconds: int = 5) -> dict:
    return {"status": "success",
            "data": "https://placehold.co/placeholder-video.mp4",
            "metadata": {"content_type": "video", "note": "Stub – Veo wired in Phase 3"}}

video_generator = LlmAgent(name="VideoGenerator", model="gemini-2.0-flash",
    tools=[_stub_generate_video], ...)
```

**`EventInfoGatherer` – `save_event_info` tool**
Uses `ToolContext` (ADK-injected) to write to session state:
```python
from google.adk.tools import ToolContext

def save_event_info(tool_context: ToolContext, event_name: str = "", ...) -> dict:
    """Save event fields to session state. Call incrementally as user provides info."""
    updates = {k: v for k, v in locals().items() if k != "tool_context" and v}
    existing = tool_context.state.get("event_info", {})
    tool_context.state["event_info"] = {**existing, **updates}
    return {"status": "saved", "fields": list(updates.keys())}
```

**`agent.py`** (unchanged shape, new import)
```python
from agents import orchestrator
root_agent = orchestrator  # adk web reads this
```

### Verification
```bash
cd apps/agent-service && adk web
# Select Orchestrator → test multi-turn gathering → content generation
```

---

## Phase 2 — FastAPI App + WebSocket + Auth + Sessions

**Goal:** Wrap the ADK agent in a production FastAPI app with auth,
WebSocket streaming, and Vertex AI session persistence.

### New directory structure additions

```
apps/agent-service/
├── main.py
├── config.py
├── api/
│   ├── __init__.py
│   ├── auth.py           # Firebase token dep
│   ├── chat.py           # /chat/ws WebSocket (+ /chat/live slot)
│   └── health.py         # /health
├── services/
│   ├── __init__.py
│   ├── session_service.py  # get_or_create_session + Firestore index
│   └── firestore_service.py # session_id ↔ (userId, eventId) mapping
```

### Key implementation notes

**`config.py`**
```python
class Settings(BaseSettings):
    google_cloud_project: str
    google_cloud_location: str = "us-central1"
    gcs_bucket_name: str
    firebase_project_id: str
    agent_app_name: str = "evento"
    session_service: str = "memory"  # "memory" | "vertexai"
    # Live API — reserved, not yet active
    live_api_enabled: bool = False
```

**`main.py`** — module-level singletons, per bidi-demo pattern
```python
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService, VertexAiSessionService
from agent import root_agent
from config import settings

# ── Session service (env-flag selects impl) ──────────────────────────────────
if settings.session_service == "vertexai":
    session_service = VertexAiSessionService(
        project=settings.google_cloud_project,
        location=settings.google_cloud_location,
    )
else:
    session_service = InMemorySessionService()   # local dev

# ── Single runner for the whole app ──────────────────────────────────────────
runner = Runner(
    agent=root_agent,
    app_name=settings.agent_app_name,
    session_service=session_service,
)

app = FastAPI(title="Evento Agent Service")
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(chat.router)  # passes runner + session_service via app.state
```

**`api/auth.py`** — Firebase ID token verification
```python
import firebase_admin
from firebase_admin import auth as fb_auth

firebase_admin.initialize_app()   # Uses ADC automatically on Cloud Run

async def get_current_user(creds = Depends(HTTPBearer())) -> dict:
    try:
        return fb_auth.verify_id_token(creds.credentials)
    except Exception:
        raise HTTPException(401, "Invalid token")
```

**`api/chat.py`** — WebSocket endpoint (text streaming)
```python
@router.websocket("/chat/ws/{event_id}")
async def chat_ws(websocket: WebSocket, event_id: str,
                  token: str = Query(...)):   # query-param token for WS auth
    claims = fb_auth.verify_id_token(token)
    user_id = claims["uid"]

    # Get or create session (ADK recommended pattern)
    session_id = await firestore_svc.get_session_id(user_id, event_id)
    if not session_id:
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id)
        session_id = session.id
        await firestore_svc.store_session_id(user_id, event_id, session_id)
    else:
        existing = await session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id)
        if not existing:
            session = await session_service.create_session(
                app_name=APP_NAME, user_id=user_id, session_id=session_id)

    await websocket.accept()
    # stream runner.run_async events → websocket.send_json(...)
    # Live API slot: /chat/live/ws/{event_id} — reserved, not yet wired
```

**`services/firestore_service.py`**
Stores: `/sessions/{userId}/events/{eventId}` → `{session_id, created_at}`.

### New dependencies
```toml
dependencies = [
    "google-adk[vertexai]>=0.6.0",
    "google-cloud-firestore>=2.0.0",
    "firebase-admin>=6.0.0",
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "pydantic-settings>=2.0.0",
    "websockets>=13.0",
]
```

### `.env.example` additions
```
SESSION_SERVICE=memory           # memory | vertexai
GCS_BUCKET_NAME=evento-media-xxx
FIREBASE_PROJECT_ID=xxx
GOOGLE_CLOUD_PROJECT=xxx
GOOGLE_CLOUD_LOCATION=us-central1
LIVE_API_ENABLED=false           # reserved
```

### Verification
```bash
uvicorn main:app --reload --port 8080
# WebSocket test via Postman: ws://localhost:8080/chat/ws/event-123?token=<firebase-id-token>
# adk web STILL works independently for agent-only testing
```

---

## Phase 3 — Media: GCS + Image Upload/Resize + Veo Integration

**Goal:** Add media upload API (user images, resized for agent), GCS storage
service, and wire real Veo video generation into VideoGenerator.

### New files

```
apps/agent-service/
├── api/
│   └── media.py              # /media/upload, /media/{path}
├── services/
│   └── storage_service.py    # GCS: upload_bytes, get_signed_url
```

**`api/media.py`** — user image upload
```python
@router.post("/media/upload")
async def upload_image(
    event_id: str,
    file: UploadFile,
    user: dict = Depends(get_current_user),
):
    """Accept user image upload. Resize to 1024px wide, save both original
    and resized to GCS. Return GCS paths. The resized version is the one
    passed to agent tools to minimise token costs."""
    original_bytes = await file.read()
    resized_bytes = _resize_image(original_bytes, max_width=1024)  # Pillow
    original_path = await storage_svc.upload(original_bytes, f"originals/{event_id}/...")
    resized_path  = await storage_svc.upload(resized_bytes,  f"resized/{event_id}/...")
    return {"original": original_path, "resized": resized_path}
```

**`agents/video_generator.py`** — replace stub with real Veo
```python
async def generate_video_clip(prompt: str, duration_seconds: int = 5) -> dict:
    """Generate a 5-second 1080p event video using Veo and upload to GCS."""
    client = genai.Client(vertexai=True, project=settings.google_cloud_project,
                          location=settings.google_cloud_location)
    operation = client.models.generate_videos(
        model="veo-3.1-fast-generate-preview",   # fallback: "veo-2-generate-preview"
        prompt=prompt,
        config=genai.types.GenerateVideoConfig(
            aspect_ratio="16:9",
            output_gcs_uri=f"gs://{settings.gcs_bucket_name}/videos/",
            duration_seconds=duration_seconds,
        ),
    )
    while not operation.done:
        await asyncio.sleep(5)
        operation = client.operations.get(operation)
    video_uri = operation.response.generated_videos[0].video.uri
    return {"status": "success", "data": video_uri,
            "metadata": {"content_type": "video", "resolution": "1080p",
                         "duration_seconds": duration_seconds}}
```

### New dependencies
```toml
"google-cloud-storage>=2.0.0",
"google-genai>=1.0.0",   # for Veo API
"Pillow>=10.0.0",         # image resize
```

---

## Phase 4 — Monorepo Cleanup + Cloud Run Deployment

**Goal:** Remove `api-service` from the monorepo, update root config files,
and deploy `agent-service` to Cloud Run.

### Monorepo config changes

**`pnpm-workspace.yaml`** — no change needed (`apps/*` glob still works after
removing `api-service`; pnpm ignores missing optional packages).

**`turbo.json`** — add `agent-service` as non-JS package exclusion:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": { ... },
  "pipeline": {},
  "// comment": "agent-service is a Python app managed by uv, not turbo"
}
```

**`package.json`** root — remove `sharp` from `onlyBuiltDependencies` if it
was only needed by `api-service`. Keep if `web` uses it.

**Action:** Archive `apps/api-service/` → `docs/archived/api-service/` or
simply `git rm -r apps/api-service/`.

### Dockerfile
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev
COPY . .
EXPOSE 8080
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Cloud Run deploy
```bash
gcloud run deploy evento-agent-service \
  --source apps/agent-service \
  --region us-central1 \
  --set-env-vars SESSION_SERVICE=vertexai,GOOGLE_CLOUD_PROJECT=xxx,...
  --service-account evento-agent-sa@xxx.iam.gserviceaccount.com
```

**Required GCP IAM roles for the service account:**
- `roles/aiplatform.user` — Vertex AI / Agent Engine sessions
- `roles/datastore.user` — Firestore session index
- `roles/storage.objectAdmin` — GCS media bucket
- Firebase rules handle client-side auth (no server IAM needed)

---

## Delivery Checklist

```
Phase 1 — Agent Architecture (testable via adk web)
[ ] agents/models.py
[ ] agents/multimodal_content_creator.py
[ ] agents/video_generator.py (stub)
[ ] agents/content_generator.py
[ ] agents/research_and_planner.py
[ ] agents/content_generation_manager.py
[ ] agents/event_info_gatherer.py (save_event_info with ToolContext)
[ ] agents/orchestrator.py (rewrite)
[ ] agents/__init__.py + agent.py (update)
[ ] DELETE: pipeline, visual_designer, trend_analyst, creative_writer

Phase 2 — FastAPI + Auth + WebSocket + Sessions
[ ] config.py
[ ] main.py (module-level runner + session_service singletons)
[ ] api/auth.py (Firebase)
[ ] api/chat.py (WebSocket, get-or-create session)
[ ] api/health.py
[ ] services/session_service.py (env-flag: memory | vertexai)
[ ] services/firestore_service.py (session_id ↔ userId+eventId)
[ ] pyproject.toml (new deps)
[ ] .env.example (updated)

Phase 3 — Media + Veo
[ ] services/storage_service.py (GCS)
[ ] api/media.py (user image upload + resize; GCS signed URL)
[ ] agents/video_generator.py (real Veo, replace stub)

Phase 4 — Monorepo + Deploy
[ ] Remove apps/api-service (git rm or archive)
[ ] Update turbo.json / package.json if needed
[ ] Dockerfile
[ ] Cloud Run deploy + IAM
[ ] Update docs/AGENT_ARCHITECTURE.md diagram
```
