"""Evento agent entry point.

Loads .env before any agent imports, then exposes root_agent so ADK can
discover and run the Orchestrator.

Usage:
Usage:
    cd apps/agent_service
    adk web        # dev UI at http://localhost:8000, select "app"
    adk run app    # terminal chat
"""

# Load .env FIRST — before any google.adk or agent imports.
# ADK docs recommend placing .env inside the package folder (this directory).
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    # python-dotenv not installed — env vars must be set externally (e.g. Cloud Run)
    pass

from .agents import orchestrator  # noqa: E402

# ADK reads this module-level variable as the entry-point agent.
root_agent = orchestrator
