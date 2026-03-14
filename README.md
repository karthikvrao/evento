# Evento 🎪

> AI-powered event content creation app — built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)

**Category:** Creative Storyteller ✍️ — Multimodal Storytelling with Interleaved Output

Evento uses a multi-agent architecture powered by Google ADK to generate rich, mixed-media event content (text, images, audio, video) in a single cohesive stream.

## Architecture

```
Orchestrator (LlmAgent, root)
├── EventInfoGatherer         → multi-turn Q&A, saves event details to session state
└── ContentGenerationManager  → decides pipeline, drives content creation
    ├── ResearchAndPlanner    → Google Search grounding + content plan
    └── ContentGenerator      → fans out to content tools simultaneously
        ├── MultimodalContentCreator → text + inline images (gemini-2.0-flash-preview-image-generation)
        └── VideoGenerator           → Veo 5s 1080p teaser → GCS
```

## Technical Highlights

- **Scalable Multimodal Handling**: Uses GCS Signed URLs and a custom `StorageService` for direct-to-cloud media uploads. This bypasses the overhead of Base64 encoding over WebSockets, ensuring performance for high-resolution images and Veo videos.
- **Optimized Frontend UX**: Agents return directly renderable media URLs (GCS or local) within their JSON response. This enables the React frontend to display generated content instantly without secondary "fetch artifact" round-trips.
- **Lean Session State**: Leverages ADK `after_model_callback` to intercept and process generated images. Media is uploaded and replaced with URLs in the final payload, keeping the persistent session state clean and avoiding state bloat.
- **Modern Auth Architecture**: Utilizes Firebase SDK natively on the frontend for identity management (Sign-up/Login/Google Auth), with a lean FastAPI dependency for ID token verification on the backend.
|-------|------|
| Frontend | React + Vite, TanStack Query, Shadcn UI |
| Agent Service | FastAPI + Python ADK, Gemini models, Firebase Auth, WebSocket |
| Storage | Firestore (session index), Google Cloud Storage (media) |
| Deployment | Cloud Run |

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10.6 (via corepack: `corepack enable`)
- **Python** 3.14 (via [uv](https://docs.astral.sh/uv/))
- **Google Cloud** project with Vertex AI API enabled

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/<your-org>/evento.git
cd evento

# Install Node.js dependencies (all workspaces)
pnpm install

# Install Python dependencies (agent service)
cd apps/agent_service && uv sync && cd ../..
```

### 2. Environment Setup

```bash
# apps/agent_service/app/.env  (canonical per ADK docs — .env lives inside the package)
cp apps/agent_service/app/.env.example apps/agent_service/app/.env
# Edit app/.env and fill in your credentials
```

Key vars:
```
GOOGLE_GENAI_USE_VERTEXAI=FALSE   # TRUE for Vertex AI, FALSE for AI Studio
GOOGLE_API_KEY=<your-key>         # Google AI Studio key (local dev)
GOOGLE_CLOUD_PROJECT=<project-id>
GOOGLE_CLOUD_LOCATION=us-central1
```

### 3. Run Development Servers

```bash
# Start all services via Turborepo
pnpm dev or turbo dev

# Or start individually:
# Agent Service — ADK dev UI (agents only, no auth)
cd apps/agent_service && adk web
# → http://localhost:8000, select "app"

# Or terminal chat:
cd apps/agent_service && adk run app

# Frontend (port 5173)
cd apps/web && pnpm dev
```

### 4. Verify Installation

```bash
# Check web app
curl http://localhost:5173

# Verify ADK and agent tree load cleanly
cd apps/agent_service
.venv/bin/python -c "from app.agent import root_agent; print('✅', root_agent.name)"
```

## Project Structure

```
evento/
├── apps/
│   ├── web/                       # React + Vite frontend
│   └── agent_service/             # Python FastAPI + ADK multi-agent service
│       ├── app/                   # ADK-discoverable package
│       │   ├── __init__.py
│       │   ├── agent.py           # root_agent = orchestrator; loads .env
│       │   ├── .env               # env vars (inside package per ADK docs)
│       │   ├── agents/            # All LlmAgent definitions
│       │   └── tools/             # Shared tools (Search, GCS, etc.)
│       ├── main.py                # FastAPI app (Phase 2)
│       ├── api/                   # FastAPI routes (Phase 2)
│       ├── services/              # GCS, Firestore, session services (Phase 2+)
│       └── pyproject.toml
├── packages/                      # Shared libraries (types, utils)
├── .agents/skills/                # Coding agent skills
├── docs/                          # Project documentation
├── turbo.json
├── pnpm-workspace.yaml
└── AGENTS.md
```

## Deployment

### Agent Service → Cloud Run

```bash
cd apps/agent_service
gcloud run deploy evento-agent-svc \
  --source . \
  --region=us-central1 \
  --set-env-vars SESSION_SERVICE=vertexai,GOOGLE_CLOUD_PROJECT=$PROJECT_ID
```

### Web → Cloud Run

```bash
# Deploy via gcloud (or use GitHub Actions CI/CD)
gcloud run deploy evento-web --source apps/web
```

## Tech Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** React, Vite, TanStack Query, Shadcn UI
- **Agents:** Google ADK (Python), Gemini 2.0 Flash-001 / gemini-2.0-flash-preview-image-generation / Veo
- **Cloud:** Cloud Run, Vertex AI Session Service, Firestore, GCS, Firebase Auth

## License

MIT
