import io
import asyncio
import logging
from PIL import Image
from google.genai import types
from app.services.storage_service import storage_svc
from app.utils.constants import IMAGE_MAX_WIDTH, IMAGE_JPEG_QUALITY

logger = logging.getLogger(__name__)

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
