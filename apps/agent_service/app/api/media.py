from fastapi import APIRouter, Depends, Query, Request, HTTPException
from typing import Optional
from app.api.auth import get_current_user
from app.services.storage_service import storage_svc
from app.services.firestore_service import save_media_asset, get_media_for_event
from app.utils.constants import SIGNED_URL_EXPIRATION_MINUTES

router = APIRouter(tags=["Media"])

@router.get("/events/{event_id}/media")
async def get_event_media(
    event_id: str,
    session_id: Optional[str] = Query(None, description="Optional session filter"),
    user: dict = Depends(get_current_user)
):
    """Fetch all generated/uploaded media for an event."""
    try:
        assets = await get_media_for_event(event_id, session_id=session_id)
        return {"media_assets": assets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/events/{event_id}/media")
async def record_user_uploaded_media(
    event_id: str,
    request: Request,
    user: dict = Depends(get_current_user)
):
    """Record metadata for a file a user uploaded via signed URL.
    
    Expected body shape:
    { "session_id": string, "gcs_path": string, "asset_type": string, "mime_type": string, "title": string }
    """
    body = await request.json()
    try:
        asset_id = await save_media_asset({
            "event_id": event_id,
            "session_id": body.get("session_id"),
            "source": "user_upload",
            "asset_type": body.get("asset_type", "image"),
            "subtype": None,
            "parent_asset_id": None,
            "gcs_path": body.get("gcs_path"),
            "content_category": "attachment",
            "title": body.get("title", "User Upload"),
            "mime_type": body.get("mime_type", "application/octet-stream"),
            "rich_content": None,
            "subject": None,
        })
        return {"status": "success", "asset_id": asset_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/media/signed-url")
def get_signed_url(
    event_id: str = Query(..., description="ID of the event to store the media under"),
    session_id: str = Query(..., description="ID of the chat session"),
    object_name: str = Query(..., description="Name of the file to upload (e.g. image.jpg)"),
    content_type: str = Query(..., description="MIME type of the file (e.g. image/jpeg)"),
    user: dict = Depends(get_current_user)
):
    """Generates a secure, time-limited signed URL for direct frontend uploads to GCS."""
    
    # Store originals under a dedicated path prefix grouped by session_id as well
    dest_path = f"originals/{event_id}/{session_id}/{object_name}"
    
    signed_url = storage_svc.generate_signed_upload_url(
        dest_path=dest_path,
        content_type=content_type,
        expiration_minutes=SIGNED_URL_EXPIRATION_MINUTES
    )
    
    # The frontend will PUT to `signed_url`. 
    # After successful upload, the final GS URI will be f"gs://<bucket>/{dest_path}"
    # The frontend should echo this GS URI back over the WebSocket.
    
    return {
        "signed_url": signed_url,
        "dest_path": dest_path
    }

@router.put("/media/local/upload")
async def local_upload(request: Request, dest_path: str = Query(...)):
    """Local-only endpoint mimicking a GCS signed URL PUT upload."""
    if storage_svc.is_local:
        data = await request.body()
        content_type = request.headers.get("content-type", "application/octet-stream")
        storage_svc.upload_bytes(data, dest_path, content_type)
        return {"status": "success"}
    return {"status": "ignored"}

