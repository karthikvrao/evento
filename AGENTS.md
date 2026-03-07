# AGENTS.md: Evento (Multi-Agent Multimodal App)

> **Hackathon:** [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)
> **Category:** Creative Storyteller ✍️ – Multimodal Storytelling with Interleaved Output
> **Architecture:** Hybrid Monorepo (TS API Service + Python Multi-Agent Service)
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
* **Orchestrator (TS):** Fastify + **BetterAuth** (AuthN/AuthZ) + **Sharp** (Image Preprocessing).
* **Agent Service (Python):** Google ADK + Gemini models (Pro / Flash).
* **Storage/DB:** Firestore (Agent Memory/Tasks), GCS (Multimodal Assets).

## 3. Multi-Agent Architecture (Hybrid Workflow Pattern)

Uses ADK's **Workflow Agents** for simultaneous execution with a gather step:

```
SequentialAgent("ContentPipeline")
├── TrendAnalyst             # Step 1: Grounded research (Google Search)
├── ParallelAgent("ContentCreators")
│   ├── CreativeWriter       # Parallel: Text/copy generation
│   └── VisualDesigner       # Parallel: Image generation (Imagen)
└── Orchestrator             # Step 3: Combine → interleaved output stream
```

| Agent | Type | Role |
|-------|------|------|
| `ContentPipeline` | SequentialAgent | Top-level workflow: research → create → assemble |
| `TrendAnalyst` | LlmAgent | Google Search grounded research, writes trend data to shared state |
| `ContentCreators` | ParallelAgent | Fan-out: runs writer + designer simultaneously |
| `CreativeWriter` | LlmAgent | Long-form email, social copy, brand voice alignment |
| `VisualDesigner` | LlmAgent | Imagen tool calls, poster layout, image-to-image editing |
| `Orchestrator` | LlmAgent | Gathers all sub-agent outputs → single interleaved mixed-media stream |

**Key ADK patterns used:**
- `SequentialAgent` for pipeline orchestration (research → create → assemble)
- `ParallelAgent` for concurrent content generation (fan-out)
- `output_key` for passing results via shared session state
- Google Search grounding available to **all** agents

## 4. Directory Structure

```text
/root
├── apps/
│   ├── web/                        # React + Vite + TanStack Query
│   ├── api-service/                # Fastify + BetterAuth + Sharp
│   │   └── src/
│   │       ├── auth/               # BetterAuth configuration
│   │       ├── routes/             # API route handlers
│   │       └── processing/         # Sharp image optimization
│   └── agent-service/              # Python ADK
│       ├── agents/
│       │   ├── orchestrator.py     # Combines outputs → interleaved stream
│       │   ├── creative_writer.py  # CreativeWriter sub-agent
│       │   ├── visual_designer.py  # VisualDesigner sub-agent
│       │   ├── trend_analyst.py    # TrendAnalyst sub-agent
│       │   └── pipeline.py         # SequentialAgent + ParallelAgent wiring
│       ├── tools/                  # Shared Tools (GCS, Search, Imagen)
│       ├── main.py                 # ADK entry point
│       ├── package.json            # Turborepo integration
│       └── pyproject.toml          # uv project config
├── packages/                       # Shared libs (types, utils)
├── .agents/skills/                 # Coding Agent Skills
├── .github/workflows/              # GitHub Actions CI/CD (IaC bonus)
├── docs/                           # Project docs (git-ignored checklists)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── AGENTS.md                       # This file
```

## 5. Rules for Coding Agents

* **Auth Enforcement:** All requests to `agent-service` must include a valid session token verified by `api-service`.
* **ADK Tools:** Use Google-style docstrings. Each tool must have clear description, input and output types.
* **Image Handling:** Raw images are resized/optimized by **Sharp** in `api-service` before sending to `agent-service` (minimizes token costs).
* **Interleaved Output:** The `Orchestrator` is responsible for combining sub-agent results into a single mixed-media response stream. Individual sub-agents return their specialized output (text, images, etc.), and the orchestrator weaves them into one cohesive interleaved output for the user.
* **Error Handling:** All agents must use `try/except` blocks and return graceful error messages. No unhandled exceptions.
* **Grounding:** Google Search tool should be available to **all agents** for grounding their outputs in real-world data. `TrendAnalyst` is the primary user, but `CreativeWriter` and `VisualDesigner` should also ground content when relevant.
* **State Keys:** Use namespaced keys (e.g., `writer:draft`, `designer:poster_url`) to avoid collisions in shared state.
* **Commits:** Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
* **Extending Capabilities:** Agents should use the `find-skills` capability (located in `~/.agents/skills/find-skills`) or the `npx skills` CLI to discover and install additional best practices, tools, or workflows as needed for the task at hand.
    - `npx skills find [query]` - Search for new skills.
    - `npx skills add <owner/repo@skill>` - Install a skill.
* **MCP Servers:** Agents have access to specialized MCP servers. Use them proactively:
    - **`context7`**: Primary tool for research. Use `resolve-library-id` followed by `query-docs` for any framework or library questions.
    - **`adk-docs-mcp`**: Use to fetch the latest ADK documentation if local context is insufficient.
    - **`cloudrun`**: Use for managing and monitoring Cloud Run services.
    - **`StitchMCP`**: Use for UI design and screen generation if needed.

## 6. Deployment Strategy

* **Compute:** Deploy `api-service` and `web` to **Cloud Run**.
* **Agent:** Deploy `agent-service` to **Cloud Run** (with ADK API server) or **Vertex AI Agent Engine**.
* **Security:** Use **IAM Service Account impersonation** for TS backend → Python Agent communication.
* **IaC (Bonus):** GitHub Actions workflows in `.github/workflows/` for automated Cloud deployment.
