from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService, VertexAiSessionService

from .config import settings
from .agent import root_agent
from .api import auth, health, chat, media, events

# ── Session service (env-flag selects impl) ──────────────────────────────────
if settings.runtime_env == "production":
    session_service = VertexAiSessionService(
        project=settings.google_cloud_project,
        location=settings.google_cloud_location,
    )
else:
    session_service = InMemorySessionService()

# ── Single runner for the whole app ──────────────────────────────────────────
runner = Runner(
    agent=root_agent,
    app_name=settings.agent_app_name,
    session_service=session_service,
)

app = FastAPI(
    title="Evento Agent Service",
    description="Multi-agent multimodal content generation service",
    version="0.1.0",
)

# CORS Middleware for local frontend proxy or explicit origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach singletons to app state for WebSocket / Routers to access
app.state.runner = runner
app.state.session_service = session_service

# Register all Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(media.router)
app.include_router(events.router)

if settings.runtime_env == "local":
    import os
    from fastapi.staticfiles import StaticFiles
    os.makedirs("/tmp/evento_media", exist_ok=True)
    app.mount("/media/local", StaticFiles(directory="/tmp/evento_media"), name="local_media")
