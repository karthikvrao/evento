import os
import sys
import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import ValidationError

logger = logging.getLogger(__name__)

env_path = os.path.join(os.path.dirname(__file__), ".env")

class Settings(BaseSettings):
    google_cloud_project: str
    google_cloud_location: str = "us-central1"
    gcs_bucket_name: str
    firebase_project_id: str
    agent_app_name: str = "evento"
    runtime_env: str = "local"  # "local" | "production"
    firebase_api_key: str = ""
    google_application_credentials: str | None = None
    # Live API — reserved, not yet active
    live_api_enabled: bool = False

    model_config = SettingsConfigDict(
        env_file=env_path,
        env_file_encoding="utf-8",
        # Allow extra environment variables not defined here
        extra="ignore"
    )

try:
    settings = Settings()
except ValidationError as e:
    print("\n❌ CONFIGURATION ERROR: Missing or invalid environment variables.", file=sys.stderr)
    for error in e.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        print(f"  - {field}: {error['msg']}", file=sys.stderr)
    print("\nPlease verify your .env file or environment variables.\n", file=sys.stderr)
    sys.exit(1)
