# Productivity Agent Implementation Plan
## ADK + Google Workspace MCP Integration

> **Stack context:** Google ADK (Python), Firebase Hosting (frontend), Cloud Run (ADK backend + MCP server), Firestore (token storage), Firebase Auth (Google Sign-In via redirect).

---

## Overview of Phases

| Phase | What | Prerequisite |
|-------|------|-------------|
| 1 | Google Cloud & OAuth prerequisites | Nothing |
| 2 | Workspace consent flow (frontend + backend) | Phase 1 |
| 3 | Refresh token storage & access token minting | Phase 2 |
| 4 | Deploy `workspace-mcp` to Cloud Run | Phase 1 |
| 5 | Wire MCP toolset into ADK agent | Phases 3 & 4 |
| 6 | End-to-end testing & hardening | All prior phases |

---

## Phase 1 — Google Cloud & OAuth Prerequisites

### 1.1 Enable Google APIs

In your GCP project (the same one used by Firebase), enable the following APIs via **APIs & Services → Library**:

- Gmail API
- Google Calendar API
- Tasks API *(use this for notes — Google Keep has no public API)*
- Google People API *(optional, for contacts)*

### 1.2 Create the OAuth 2.0 Client

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
2. Application type: **Web Application**
3. Name it something like `productivity-agent-web`
4. **Authorized Redirect URIs** — add:
   ```
   https://your-backend-service.run.app/auth/workspace/callback
   ```
   > This is your ADK backend Cloud Run service URL + `/auth/workspace/callback`. It is **not** your Firebase Hosting URL, and is entirely separate from the Firebase sign-in popup redirect. It is only hit during the one-time workspace consent step.
5. Download the client secret JSON and note the `client_id` and `client_secret`.

### 1.3 Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth Consent Screen**
2. User type: **External** (covers both Gmail and Google Workspace accounts)
3. Fill in app name, support email, developer contact
4. **Scopes to add:**
   ```
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/tasks
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/userinfo.profile
   ```
5. While in development, add test users under **Test Users** (required until your app passes Google verification)
6. Once ready for production: submit for **Google verification** — required for apps accessing Gmail/Calendar with more than 100 users or with sensitive scopes

### 1.4 Store OAuth Credentials Securely

Store `client_id` and `client_secret` in **Google Cloud Secret Manager** (not in env vars or source code):

```bash
gcloud secrets create GOOGLE_OAUTH_CLIENT_ID --data-file=- <<< "your_client_id"
gcloud secrets create GOOGLE_OAUTH_CLIENT_SECRET --data-file=- <<< "your_client_secret"
```

Grant your Cloud Run service account access:
```bash
gcloud secrets add-iam-policy-binding GOOGLE_OAUTH_CLIENT_ID \
  --member="serviceAccount:your-sa@your-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Phase 2 — Workspace Consent Flow

This is a **one-time flow per user**, triggered after their first Firebase sign-in. It runs alongside but separately from Firebase auth.

### 2.1 Switch Firebase Auth to `signInWithRedirect`

Replace `signInWithPopup` with redirect-based sign-in to avoid two consecutive popups and to support chaining the workspace consent into a single navigation flow.

**Frontend changes:**

```javascript
// auth.js (or wherever sign-in is triggered)
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult
} from "firebase/auth";

const auth = getAuth();
const provider = new GoogleAuthProvider();

// Sign-in button handler
export async function signInWithGoogle() {
  // Preserve the 'next' param through the redirect
  // Firebase internally handles returning to your app after auth
  await signInWithRedirect(auth, provider);
}

// Call this on app load / route guard
export async function handleRedirectResult() {
  const result = await getRedirectResult(auth);

  if (result) {
    // Firebase sign-in just completed
    const user = result.user;
    const needsWorkspaceConsent = await checkWorkspaceConsent(user.uid); // see 2.3

    if (needsWorkspaceConsent) {
      // Preserve 'next' param through the workspace consent chain
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = `/auth/workspace/initiate?next=${encodeURIComponent(next)}`;
    } else {
      // Returning user — go directly to destination
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;
    }
  }
}
```

> **`next` param preservation:** The `next` param survives because it lives in your app URL (e.g., `/signin?next=/dashboard`). When Firebase redirects back to your app after auth, you're back on the same `/signin?next=...` URL, so it's still readable. You then explicitly pass it forward into the workspace consent redirect chain.

### 2.2 Backend: `/auth/workspace/initiate` Endpoint

This endpoint builds the Google OAuth authorization URL and redirects the user to Google's consent screen.

```python
# routes/auth_workspace.py
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
import secrets
import json

router = APIRouter()

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
]

REDIRECT_URI = "https://your-backend-service.run.app/auth/workspace/callback"

@router.get("/auth/workspace/initiate")
async def initiate_workspace_auth(request: Request, next: str = "/"):
    flow = Flow.from_client_config(
        get_oauth_client_config(),  # reads from Secret Manager
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    # Encode 'next' into OAuth state param — it will be echoed back by Google
    state_data = {
        "next": next,
        "csrf": secrets.token_urlsafe(16),
    }
    # state must be a string
    import base64
    state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()

    auth_url, _ = flow.authorization_url(
        access_type="offline",    # required to get refresh_token
        prompt="consent",         # required to always receive refresh_token
        include_granted_scopes="true",
        state=state,
    )

    return RedirectResponse(auth_url)
```

**Why `access_type=offline` and `prompt=consent`:**
- `access_type=offline` — tells Google to include a refresh token in the response (default is online/access token only)
- `prompt=consent` — forces Google to show the consent screen and return a fresh refresh token; without it, repeat visits silently succeed but **omit the refresh token**, which would break your backend's ability to act on the user's behalf later

### 2.3 Backend: `/auth/workspace/callback` Endpoint

```python
@router.get("/auth/workspace/callback")
async def workspace_auth_callback(request: Request, code: str, state: str):
    import base64, json

    # Decode state to recover 'next'
    state_data = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
    next_url = state_data.get("next", "/")

    flow = Flow.from_client_config(
        get_oauth_client_config(),
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
        state=state,
    )
    flow.fetch_token(code=code)

    credentials = flow.credentials
    refresh_token = credentials.refresh_token
    user_email = credentials.id_token.get("email")  # or fetch from userinfo

    # Get Firebase UID from email (or require it in state)
    user_id = await get_firebase_uid_by_email(user_email)

    # Store refresh token encrypted in Firestore (see Phase 3)
    await store_refresh_token(user_id, refresh_token)

    # Redirect user back to the app
    return RedirectResponse(f"https://your-app.web.app{next_url}")
```

### 2.4 Frontend: `checkWorkspaceConsent` Helper

```javascript
// Check whether the backend has a stored refresh token for this user
// Call this after getRedirectResult() resolves
async function checkWorkspaceConsent(uid) {
  const idToken = await getAuth().currentUser.getIdToken();
  const res = await fetch("/api/user/workspace-status", {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const { hasConsent } = await res.json();
  return !hasConsent; // true = needs consent
}
```

Backend endpoint `/api/user/workspace-status` simply checks whether a (non-expired) refresh token exists in Firestore for this user.

---

## Phase 3 — Refresh Token Storage & Access Token Minting

### 3.1 Firestore Token Storage Schema

Store tokens in a Firestore collection, one document per user. **Encrypt the refresh token before writing** — use Cloud KMS or a symmetric key stored in Secret Manager.

```
Collection: user_workspace_tokens
Document ID: {firebase_uid}
Fields:
  refresh_token_enc: string   (AES-256 encrypted, base64)
  token_iv: string            (encryption IV, base64)
  granted_scopes: string[]
  created_at: timestamp
  updated_at: timestamp
```

```python
# token_store.py
from google.cloud import firestore
from cryptography.fernet import Fernet
import base64, os

db = firestore.AsyncClient()

def get_fernet() -> Fernet:
    # Key loaded from Secret Manager at startup
    key = os.environ["TOKEN_ENCRYPTION_KEY"]  # 32-byte base64 Fernet key
    return Fernet(key.encode())

async def store_refresh_token(user_id: str, refresh_token: str):
    f = get_fernet()
    encrypted = f.encrypt(refresh_token.encode()).decode()
    await db.collection("user_workspace_tokens").document(user_id).set({
        "refresh_token_enc": encrypted,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }, merge=True)

async def get_refresh_token(user_id: str) -> str | None:
    doc = await db.collection("user_workspace_tokens").document(user_id).get()
    if not doc.exists:
        return None
    f = get_fernet()
    encrypted = doc.to_dict()["refresh_token_enc"]
    return f.decrypt(encrypted.encode()).decode()
```

> **Why Firestore + encryption rather than Secret Manager per user:** Secret Manager charges per secret version access (~$0.03/10k operations) and has per-project limits on secret count. At scale (thousands of users), Firestore with application-level encryption is more practical. Use Secret Manager for the encryption key itself.

### 3.2 Minting a Fresh Access Token Per Agent Invocation

```python
# token_service.py
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import os

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
]

async def get_user_access_token(user_id: str) -> str:
    refresh_token = await get_refresh_token(user_id)
    if not refresh_token:
        raise ValueError(f"No workspace consent found for user {user_id}")

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["GOOGLE_OAUTH_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_OAUTH_CLIENT_SECRET"],
        scopes=SCOPES,
    )
    creds.refresh(Request())
    return creds.token  # ya29.xxx — valid for ~1 hour
```

---

## Phase 4 — Deploy `workspace-mcp` to Cloud Run

### 4.1 Why `taylorwilsdon/google_workspace_mcp`

This is the recommended open source MCP server for this use case:
- Only Google Workspace MCP with **native multi-user OAuth 2.1 + External OAuth mode** (your app owns the OAuth flow; MCP server just validates the bearer token)
- **Stateless container mode** (`WORKSPACE_MCP_STATELESS_MODE=true`) — essential for Cloud Run's ephemeral instances
- Covers Gmail, Calendar, Tasks, Drive, Docs, Sheets, Slides, Chat, Forms, Contacts — 12 services, 100+ tools
- Actively maintained with recent fixes specifically for stateless mode and Cloud Run deployments

In **External OAuth mode**, the MCP server does not run its own OAuth flow. It simply validates incoming bearer tokens against Google's userinfo API and uses them to call Workspace APIs on behalf of the token owner. This means your existing sign-in flow fully owns authentication.

### 4.2 Dockerfile

```dockerfile
# workspace-mcp/Dockerfile
FROM python:3.12-slim

RUN pip install uv
RUN uv pip install --system workspace-mcp

ENV WORKSPACE_MCP_PORT=8080
ENV WORKSPACE_MCP_STATELESS_MODE=true
ENV MCP_ENABLE_OAUTH21=true
ENV WORKSPACE_EXTERNAL_AUTH=true

EXPOSE 8080

CMD ["python", "-m", "workspace_mcp", \
     "--transport", "streamable-http", \
     "--host", "0.0.0.0", \
     "--port", "8080"]
```

### 4.3 Deploy to Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/YOUR_PROJECT/workspace-mcp ./workspace-mcp/

# Deploy — note: --no-allow-unauthenticated is intentional
# Your ADK backend uses a service account identity token to call this service
gcloud run deploy workspace-mcp \
  --image gcr.io/YOUR_PROJECT/workspace-mcp \
  --region us-central1 \
  --no-allow-unauthenticated \
  --set-env-vars WORKSPACE_MCP_STATELESS_MODE=true,MCP_ENABLE_OAUTH21=true,WORKSPACE_EXTERNAL_AUTH=true \
  --set-secrets GOOGLE_OAUTH_CLIENT_ID=GOOGLE_OAUTH_CLIENT_ID:latest,GOOGLE_OAUTH_CLIENT_SECRET=GOOGLE_OAUTH_CLIENT_SECRET:latest \
  --min-instances 0 \
  --max-instances 10
```

### 4.4 IAM: Allow ADK Backend to Invoke MCP Service

```bash
# Grant your ADK backend's service account permission to call workspace-mcp
gcloud run services add-iam-policy-binding workspace-mcp \
  --region us-central1 \
  --member="serviceAccount:adk-backend-sa@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

---

## Phase 5 — Wire MCP Toolset into the ADK Agent

### 5.1 Two-Layer Authentication Explained

When your ADK backend calls the MCP server, two separate auth credentials are involved:

| Header | Purpose | Value |
|--------|---------|-------|
| `Authorization: Bearer <token>` | User's Google OAuth access token — authorizes Workspace API calls as that user | `ya29.xxx` from Phase 3 |
| `X-Serverless-Authorization: Bearer <token>` | Cloud Run IAM identity token — proves the calling service is allowed to invoke the MCP Cloud Run service | GCP identity token fetched from metadata server |

### 5.2 Agent Factory Function

Create a per-request agent factory that injects the user's access token:

```python
# agent/factory.py
import os
import google.oauth2.id_token
import google.auth.transport.requests
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool import McpToolset, StreamableHTTPConnectionParams

MCP_SERVER_URL = os.environ["WORKSPACE_MCP_URL"]  # https://workspace-mcp-xxxx-uc.a.run.app

async def create_productivity_agent(user_id: str) -> LlmAgent:
    # 1. Mint fresh Google access token for this user
    user_access_token = await get_user_access_token(user_id)  # from Phase 3

    # 2. Get Cloud Run identity token for service-to-service auth
    auth_req = google.auth.transport.requests.Request()
    id_token = google.oauth2.id_token.fetch_id_token(auth_req, MCP_SERVER_URL)

    # 3. Build MCP toolset with both auth headers
    toolset = McpToolset(
        connection_params=StreamableHTTPConnectionParams(
            url=f"{MCP_SERVER_URL}/mcp",
            headers={
                "Authorization": f"Bearer {user_access_token}",
                "X-Serverless-Authorization": f"Bearer {id_token}",
            },
            timeout=30,
        )
    )

    return LlmAgent(
        model="gemini-2.0-flash",
        name="productivity_assistant",
        instruction="""You are a productivity assistant with access to the user's
        Gmail, Google Calendar, and Tasks. Help them manage their email, schedule,
        and task list. Always confirm before making changes (sending emails,
        creating/deleting events, etc.).""",
        tools=[toolset],
    )
```

### 5.3 Integration with Existing WebSocket/API Layer

Your existing backend already validates the Firebase ID token from the frontend on each WebSocket connection or API request. Extend that handler to also build the productivity agent:

```python
# ws_handler.py (extend your existing handler)
from firebase_admin import auth as firebase_auth
from agent.factory import create_productivity_agent

async def handle_agent_message(websocket, firebase_id_token: str, message: str):
    # Existing auth check — verify Firebase ID token
    decoded = firebase_auth.verify_id_token(firebase_id_token)
    user_id = decoded["uid"]

    # Check if workspace consent exists
    refresh_token = await get_refresh_token(user_id)
    if not refresh_token:
        await websocket.send_json({
            "type": "error",
            "code": "WORKSPACE_CONSENT_REQUIRED",
            "message": "Please complete workspace setup to use productivity features."
        })
        return

    # Build agent with user's credentials
    agent = await create_productivity_agent(user_id)

    # Run agent with existing runner/session setup
    # ... your existing ADK runner.run_async() call
```

### 5.4 Handle Consent Revocation Gracefully

If a user revokes access or the refresh token expires, `get_user_access_token` will raise. Catch this and prompt re-consent:

```python
try:
    agent = await create_productivity_agent(user_id)
except google.auth.exceptions.RefreshError:
    # Refresh token is invalid/revoked — clear stored token and ask user to re-consent
    await store_refresh_token(user_id, None)  # clear it
    await websocket.send_json({
        "type": "error",
        "code": "WORKSPACE_REAUTH_REQUIRED",
    })
    return
```

On the frontend, handle `WORKSPACE_REAUTH_REQUIRED` by redirecting to `/auth/workspace/initiate?next=<current_page>`.

---

## Phase 6 — End-to-End Testing & Hardening

### 6.1 Testing Checklist

**OAuth flow:**
- [ ] New user: Firebase sign-in → workspace consent screen appears → grant → arrives at correct `next` URL
- [ ] Returning user: Firebase sign-in → no consent screen → arrives at correct `next` URL
- [ ] `next` param survives both the Firebase redirect and the workspace consent redirect chain
- [ ] User with revoked access: error returned, re-consent flow triggers correctly
- [ ] Test with a Gmail account AND a Google Workspace account

**MCP connectivity:**
- [ ] ADK agent can list tools from workspace-mcp (`McpToolset` initialises without error)
- [ ] Agent can read Gmail (search, list threads)
- [ ] Agent can create/update/delete Calendar events
- [ ] Agent can create/read/complete Tasks
- [ ] MCP server handles concurrent requests correctly (stateless mode)

**Token security:**
- [ ] Refresh tokens are encrypted at rest in Firestore (verify field is not plaintext)
- [ ] Access tokens are not logged anywhere (check Cloud Logging)
- [ ] `/auth/workspace/callback` rejects requests with missing/invalid `state` param
- [ ] MCP Cloud Run service returns 403 to unauthenticated requests

### 6.2 Key Environment Variables Summary

**ADK Backend (Cloud Run):**
```
GOOGLE_OAUTH_CLIENT_ID          (from Secret Manager)
GOOGLE_OAUTH_CLIENT_SECRET      (from Secret Manager)
TOKEN_ENCRYPTION_KEY            (Fernet key, from Secret Manager)
WORKSPACE_MCP_URL               https://workspace-mcp-xxxx-uc.a.run.app
FIREBASE_PROJECT_ID             your-project-id
```

**workspace-mcp (Cloud Run):**
```
GOOGLE_OAUTH_CLIENT_ID          (from Secret Manager)
GOOGLE_OAUTH_CLIENT_SECRET      (from Secret Manager)
WORKSPACE_MCP_STATELESS_MODE    true
MCP_ENABLE_OAUTH21              true
WORKSPACE_EXTERNAL_AUTH         true
WORKSPACE_MCP_PORT              8080
```

### 6.3 Required Python Dependencies

Add to your ADK backend's `requirements.txt`:
```
google-adk>=0.4.0
google-auth>=2.28.0
google-auth-httplib2
google-auth-oauthlib
google-cloud-firestore
google-cloud-secret-manager
cryptography                    # for Fernet token encryption
firebase-admin
```

### 6.4 Notes on Google Keep

Google Keep has **no public API**. Use **Google Tasks** as the notes/reminders store — it is fully supported by `workspace-mcp` and is a natural fit for task and note management. If richer note content is needed, consider a dedicated Google Doc per user (also supported by `workspace-mcp`).

---

## Architecture Summary Diagram

```
User Browser (Firebase Hosting)
│
│  1. signInWithRedirect() — Firebase Google auth
│  2. getRedirectResult() — if new user → /auth/workspace/initiate?next=...
│  3. Google consent screen (once ever) → /auth/workspace/callback
│  4. Stored refresh token → redirect to app
│  5. Subsequent sessions: Firebase restores session silently, no redirects
│
▼
Your ADK Backend (Cloud Run)
│  - Validates Firebase ID token on every WS/API request
│  - Retrieves encrypted refresh token from Firestore
│  - Mints fresh Google access token (ya29.xxx)
│  - Fetches Cloud Run identity token
│  - Builds McpToolset with both tokens
│  - Runs LlmAgent
│
▼
workspace-mcp (Cloud Run — separate service)
│  - WORKSPACE_EXTERNAL_AUTH=true (no internal OAuth)
│  - Validates ya29.xxx against Google userinfo API
│  - Calls Gmail / Calendar / Tasks APIs as that user
│  - Stateless: no session state between requests
│
▼
Google APIs (Gmail, Calendar, Tasks)
```

---

*Last updated: April 2026*
