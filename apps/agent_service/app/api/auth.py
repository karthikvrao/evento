import os
import firebase_admin
from firebase_admin import auth as fb_auth
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()

from ..config import settings

# Initialize Firebase
# On GCP, this uses Application Default Credentials automatically.
# Locally, it uses credentials from GOOGLE_APPLICATION_CREDENTIALS or gcloud login.
if settings.google_application_credentials:
    if os.path.isabs(settings.google_application_credentials):
         os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.google_application_credentials
    else:
        # If relative, join with the app/ package root
        base_dir = os.path.dirname(os.path.dirname(__file__))
        abs_path = os.path.join(base_dir, settings.google_application_credentials)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = abs_path

try:
    firebase_admin.initialize_app(options={
        'projectId': settings.firebase_project_id,
    })
except ValueError:
    # Already initialized
    pass

security = HTTPBearer()

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verifies the Firebase ID token in the Authorization header.
    Returns the decoded token claims, which includes 'uid'.
    """
    try:
        claims = fb_auth.verify_id_token(creds.credentials)
        return claims
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid Firebase authentication token: {e}"
        )
