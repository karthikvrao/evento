import firebase_admin
from firebase_admin import auth as fb_auth
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()

# Initialize Firebase (uses Application Default Credentials on GCP,
# or explicit API keys if using FIREBASE_PROJECT_ID/service accounts locally)
try:
    firebase_admin.initialize_app()
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
