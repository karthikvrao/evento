import io
import uuid
import asyncio
import logging
from typing import Optional
from PIL import Image
from google.genai import types
from app.services.storage_service import storage_svc
from app.utils.constants import IMAGE_MAX_WIDTH, IMAGE_JPEG_QUALITY, THUMBNAIL_MAX_WIDTH

logger = logging.getLogger(__name__)


def resize_and_upload_image(
    image_bytes: bytes,
    dest_prefix: str,
    max_width: int = IMAGE_MAX_WIDTH,
    quality: int = IMAGE_JPEG_QUALITY,
    filename: Optional[str] = None,
) -> str:
    """Resize raw image bytes to max_width, upload to GCS, and return the URI.

    This is a general-purpose helper used for:
      - Full-size uploads (max_width=1024, dest_prefix="generated/{session}/")
      - Thumbnail generation (max_width=200, dest_prefix="thumbnails/{session}/")

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, etc.).
        dest_prefix: GCS path prefix — e.g. "generated/{session_id}/".
        max_width: Maximum width in pixels; aspect ratio is preserved.
        quality: JPEG compression quality (1–100).
        filename: Optional filename; auto-generated if omitted.

    Returns:
        The GCS URI (gs://...) or local:// URI of the uploaded image.
    """
    image = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if needed (handles RGBA, palette modes)
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    # Only downscale — never upscale
    if image.width > max_width:
        ratio = max_width / image.width
        new_size = (max_width, int(image.height * ratio))
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    out_io = io.BytesIO()
    image.save(out_io, format="JPEG", quality=quality)
    resized_bytes = out_io.getvalue()

    if not filename:
        filename = f"img_{uuid.uuid4().hex[:8]}.jpg"

    dest_path = f"{dest_prefix.rstrip('/')}/{filename}"
    return storage_svc.upload_bytes(resized_bytes, dest_path, "image/jpeg")


def process_image(gs_uri: str) -> types.Part:
    """Downloads an image from GCS, resizes to max width, re-uploads, and returns a Part."""
    try:
        image_bytes = storage_svc.download_as_bytes(gs_uri)
        image = Image.open(io.BytesIO(image_bytes))
        
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            
        if image.width > IMAGE_MAX_WIDTH:
            ratio = IMAGE_MAX_WIDTH / image.width
            new_size = (IMAGE_MAX_WIDTH, int(image.height * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
            
        out_io = io.BytesIO()
        image.save(out_io, format="JPEG", quality=IMAGE_JPEG_QUALITY)
        resized_bytes = out_io.getvalue()
        
        # Replace 'originals/' with 'resized/' in the path
        path_parts = gs_uri.replace("gs://", "").split("/", 1)
        if len(path_parts) > 1:
            blob_path = path_parts[1]
            dest_path = blob_path.replace("originals/", "resized/", 1)
        else:
            dest_path = f"resized/image_{int(asyncio.get_event_loop().time())}.jpg"
            
        resized_uri = storage_svc.upload_bytes(resized_bytes, dest_path, "image/jpeg")
        return types.Part.from_uri(file_uri=resized_uri, mime_type="image/jpeg")
    except Exception as e:
        logger.error(f"Image processing failed for {gs_uri}: {e}")
        # Fallback to the original URI
        return types.Part.from_uri(file_uri=gs_uri, mime_type="image/jpeg")
