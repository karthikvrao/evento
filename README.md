# Evento 🎪

> AI-powered event content creation app — built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)

**Category:** Creative Storyteller ✍️ — Multimodal Storytelling with Interleaved Output

Evento uses a multi-agent architecture powered by Google ADK to generate rich, mixed-media event content (text, images, audio, video) in a single cohesive stream.

## Architecture

```
SequentialAgent("ContentPipeline")
├── TrendAnalyst             → Grounded research via Google Search
├── ParallelAgent("ContentCreators")
│   ├── CreativeWriter       → Text/copy generation
│   └── VisualDesigner       → Image generation (Imagen)
└── Orchestrator             → Combines all → interleaved output stream
```

| Layer | Tech |
|-------|------|
| Frontend | React + Vite, TanStack Query, Shadcn UI |
| API Service | Fastify, BetterAuth, Sharp |
| Agent Service | Python ADK, Gemini models |
| Storage | Firestore, Google Cloud Storage |
| Deployment | Cloud Run (web + API), Vertex AI Agent Engine (agents) |

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
cd apps/agent-service
uv sync
cd ../..
```

### 2. Environment Setup

Create `.env` files for each service:

```bash
# apps/api-service/.env
PORT=3001
FRONTEND_URL=http://localhost:5173

# apps/agent-service/.env
GOOGLE_CLOUD_PROJECT=<your-project-id>
GOOGLE_CLOUD_LOCATION=us-central1
```

### 3. Run Development Servers

```bash
# Start all services via Turborepo
pnpm dev or turbo dev

# Or start individually:
# Frontend (port 5173)
cd apps/web && pnpm dev

# API Service (port 3001)
cd apps/api-service && pnpm dev

# Agent Service (ADK dev server)
cd apps/agent-service && uv run adk web
```

### 4. Verify Installation

```bash
# Check web app
curl http://localhost:5173

# Check API health
curl http://localhost:3001/health

# Verify ADK is installed
cd apps/agent-service && uv run python -c "import google.adk; print('ADK', google.adk.__version__)"
```

## Project Structure

```
evento/
├── apps/
│   ├── web/                    # React + Vite frontend
│   ├── api-service/            # Fastify API (auth, image processing)
│   └── agent-service/          # Python ADK multi-agent service
│       ├── agents/
│       │   ├── pipeline.py     # SequentialAgent + ParallelAgent wiring
│       │   ├── orchestrator.py # Combines outputs → interleaved stream
│       │   ├── creative_writer.py
│       │   ├── visual_designer.py
│       │   └── trend_analyst.py
│       ├── tools/              # Shared tools (Search, Imagen, GCS)
│       ├── main.py             # ADK entry point (root_agent)
│       └── package.json        # Turborepo integration
├── packages/                   # Shared libraries (types, utils)
├── .agents/skills/             # Coding agent skills (11 installed)
├── docs/                       # Project documentation
├── turbo.json                  # Turborepo task pipeline
├── pnpm-workspace.yaml         # pnpm workspace config
└── AGENTS.md                   # Agent architecture & conventions
```

## Deployment

### Agent Service → Vertex AI Agent Engine

```bash
cd apps/agent-service
adk deploy agent_engine \
  --project=$PROJECT_ID \
  --region=us-central1 \
  --display_name="Evento Agent" \
  .
```

### Web + API → Cloud Run

```bash
# Deploy via gcloud (or use GitHub Actions CI/CD)
gcloud run deploy evento-web --source apps/web
gcloud run deploy evento-api --source apps/api-service
```

## Tech Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** React, Vite, TanStack Query, Shadcn UI
- **API:** Fastify, BetterAuth, Sharp
- **Agents:** Google ADK (Python), Gemini 2.0 Flash/Pro
- **Cloud:** Google Cloud Run, Vertex AI Agent Engine, Firestore, GCS

## License

MIT
