"""One-time script to create a Vertex AI Agent Engine instance.

This creates the cloud resource needed for VertexAiSessionService.
Run once, then copy the printed AGENT_ENGINE_ID into your .env file.

Prerequisites:
  - GOOGLE_APPLICATION_CREDENTIALS set to your service account JSON path
  - OR authenticated via: gcloud auth application-default login
  - vertexai package installed: pip install google-cloud-aiplatform[agent_engine]

Usage:
  cd apps/agent_service
  .venv/bin/python scripts/create_agent_engine.py
"""

import os
import sys

# Load .env so GOOGLE_APPLICATION_CREDENTIALS is available
try:
    from dotenv import load_dotenv
    from pathlib import Path
    load_dotenv(Path(__file__).parent.parent / "app" / ".env")
except ImportError:
    pass

import vertexai

# Read project and location from environment (same as your .env)
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

if not PROJECT_ID:
    print("❌ GOOGLE_CLOUD_PROJECT not set. Check your .env file.", file=sys.stderr)
    sys.exit(1)

print(f"Creating Agent Engine instance in project={PROJECT_ID}, location={LOCATION}...")
print("(This may take a minute on first use)\n")

client = vertexai.Client(project=PROJECT_ID, location=LOCATION)
agent_engine = client.agent_engines.create()

# Extract the resource ID from the full resource name
engine_id = agent_engine.api_resource.name.split("/")[-1]

print("✅ Agent Engine created successfully!")
print(f"\n   AGENT_ENGINE_ID={engine_id}\n")
print("Copy this value into your apps/agent_service/app/.env file.")
