# AGENTS.md: Evento (Multi-Agent Multimodal App)

> **Hackathon:** [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)
> **Category:** Creative Storyteller ✍️ – Multimodal Storytelling with Interleaved Output
> **Architecture:** Monorepo — React frontend + Python FastAPI/ADK agent service
> **Goal:** AI-powered event content creation app that weaves text, images, audio, and video in a single cohesive output stream.

## 1. Hackathon Context

**Mandatory Tech:**
- Gemini model (via Google GenAI SDK or ADK)
- Gemini's interleaved/mixed output capabilities
- At least one Google Cloud service
- Backend hosted on Google Cloud

**Judging (in priority order):**
1. Innovation & Multimodal UX (40%) – breaks "text box" paradigm, seamless See/Hear/Speak
2. Technical Implementation & Agent Architecture (30%) – robust ADK usage, grounding, error handling
3. Demo & Presentation (30%) – clear problem/solution, working software, architecture diagram

## 2. Tech Stack

* **Monorepo:** `pnpm` workspaces + `Turborepo` task pipeline.
* **Frontend:** React (Vite), TanStack Query, Shadcn UI.
* **Agent Service (Python):** FastAPI + Google ADK + Gemini models. Handles AuthN (Firebase), WebSocket streaming, session persistence (Vertex AI Agent Engine), and GCS media storage.
* **Storage/DB:** Firestore (session index), GCS (multimodal assets).

## 3. Multi-Agent Architecture

```
Orchestrator (LlmAgent, root)
├── EventInfoGatherer     (LlmAgent) — multi-turn info collection, saves to session state
└── ContentGenerationManager (LlmAgent) — decides pipeline, drives content creation
    ├── AgentTool: ResearchAndPlanner  (LlmAgent + BuiltInPlanner + google_search)
    └── AgentTool: ContentGenerator   (LlmAgent)
        ├── AgentTool: MultimodalContentCreator  (gemini-2.0-flash-preview-image-generation)
        └── AgentTool: VideoGenerator            (Veo via FunctionTool → GCS)
```

| Agent | Type | Role |
|-------|------|------|
| `Orchestrator` | LlmAgent | Root agent — greets users, routes to sub-agents |
| `EventInfoGatherer` | LlmAgent | Multi-turn Q&A, writes `event_info` to session state |
| `ContentGenerationManager` | LlmAgent | Decides research→generate or generate-only path |
| `ResearchAndPlanner` | LlmAgent + BuiltInPlanner | Google Search grounding + content plan |
| `ContentGenerator` | LlmAgent | Fans out to content tools simultaneously |
| `MultimodalContentCreator` | LlmAgent | Interleaved text + images (social posts, emails, posters) |
| `VideoGenerator` | LlmAgent + FunctionTool | Short video teasers via Veo API → GCS |

**Key ADK patterns:**
- LLM-driven delegation via `sub_agents` (Orchestrator → EventInfoGatherer / ContentGenerationManager)
- `AgentTool` for fan-out content generation (ContentGenerator calls all tools simultaneously)
- `BuiltInPlanner` for multi-step think-then-act in ResearchAndPlanner
- `output_key` to pass `research_and_plan` between agents via session state
- `ToolContext` for incremental state writes in `save_event_info`

**Shared state keys:**

| Key | Written by | Read by |
|-----|-----------|---------|
| `event_info` | `EventInfoGatherer` | All downstream agents |
| `user_instructions` | `EventInfoGatherer` | All downstream agents |
| `research_and_plan` | `ResearchAndPlanner` | `ContentGenerator` → content tools |

## 4. Directory Structure

```text
/root
├── apps/
│   ├── web/                         # React + Vite + TanStack Query
│   └── agent_service/               # Python FastAPI + ADK agent service
│       ├── app/                     # ADK-discoverable package (adk web)
│       │   ├── __init__.py
│       │   ├── agent.py             # root_agent = orchestrator; loads .env
│       │   ├── .env                 # env vars (inside package per ADK docs)
│       │   ├── agents/
│       │   │   ├── orchestrator.py
│       │   │   ├── event_info_gatherer.py
│       │   │   ├── content_generation_manager.py
│       │   │   ├── research_and_planner.py
│       │   │   ├── content_generator.py
│       │   │   ├── multimodal_content_creator.py
│       │   │   ├── video_generator.py
│       │   │   └── models.py        # ContentToolResult Pydantic model
│       │   └── tools/
│       │       └── search_tool.py
│       ├── main.py                  # FastAPI app (Phase 2)
│       ├── api/                     # FastAPI routes (Phase 2)
│       ├── services/                # GCS, Firestore, session services (Phase 2+)
│       ├── package.json             # Turborepo integration
│       └── pyproject.toml           # uv project config
├── packages/                        # Shared libs (types, utils)
├── .agents/skills/                  # Coding Agent Skills
├── .github/workflows/               # GitHub Actions CI/CD
├── docs/
├── pnpm-workspace.yaml
├── turbo.json
└── AGENTS.md
```

## 5. Rules for Coding Agents

* **ADK Tools:** Use Google-style docstrings. Each tool must have clear description, input and output types.
* **Auth:** Firebase ID token verified in FastAPI middleware. `adk web` has no auth (local dev only).
* **Image Handling:** User-uploaded images resized to ≤1024px wide before passing to agents (Pillow in `api/media.py`). Only resized version sent to agents to minimise token costs.
* **Interleaved Output:** `MultimodalContentCreator` produces interleaved text+images in one turn. `ContentGenerator` synthesises all tool results into a cohesive final message.
* **Error Handling:** All agents and tools must use `try/except` and return graceful error messages. No unhandled exceptions.
* **Grounding:** `ResearchAndPlanner` uses `google_search` via `BuiltInPlanner`. Other agents can also use it when relevant.
* **State Keys:** Use the defined keys only (`event_info`, `user_instructions`, `research_and_plan`). No ad-hoc state writes.
* **ContentToolResult schema:** All content AgentTools return `{"status", "data", "metadata"}` so `ContentGenerator` can compose a cohesive summary.
* **Local dev:**
    ```bash
    cd apps/agent_service
    adk web        # → http://localhost:8000, select "app"
    adk run app    # terminal chat (no UI)
    ```
* **Commits:** Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
* **Extending Capabilities:** Use `npx skills find [query]` or `npx skills add <owner/repo@skill>` to discover and install skills.
* **MCP Servers:** Use proactively:
    - **`context7`**: Library/framework docs.
    - **`adk-docs-mcp`**: Latest ADK documentation.
    - **`cloudrun`**: Cloud Run service management.
    - **`StitchMCP`**: UI design and screen generation.

## 6. Deployment Strategy

* **Compute:** Deploy `agent_service` and `web` to **Cloud Run**.
* **Sessions:** Vertex AI Agent Engine via `VertexAiSessionService` (`SESSION_SERVICE=vertexai`).
* **Security:** Firebase Auth for user AuthN; Cloud Run service account IAM for GCP resource access.
* **IaC (Bonus):** GitHub Actions workflows in `.github/workflows/`.
