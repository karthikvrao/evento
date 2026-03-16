import datetime
import urllib.parse
from pathlib import Path
from google.cloud import storage
from google.auth.exceptions import DefaultCredentialsError
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.is_local = (settings.runtime_env == "local")
        self.local_dir = Path("/tmp/evento_media")

        if self.is_local:
            self.local_dir.mkdir(parents=True, exist_ok=True)
            self.client = None
            self.bucket = None
            return
        
        try:
            self.client = storage.Client(project=settings.google_cloud_project)
            self.bucket = self.client.bucket(settings.gcs_bucket_name)
        except DefaultCredentialsError:
            logger.warning("No Google Cloud ADC found. GCS operations will fail locally if called. Continuing startup...")
            self.client = None
            self.bucket = None

    def generate_signed_upload_url(self, dest_path: str, content_type: str = "application/octet-stream", expiration_minutes: int = 15) -> str:
        """Generates a v4 signed URL for uploading a file to GCS. In local mode, returns a local upload endpoint."""
        if self.is_local:
            return f"http://localhost:8000/media/local/upload?dest_path={urllib.parse.quote(dest_path)}"

        if not self.bucket:
            raise RuntimeError("GCS client not initialized. Cannot generate signed URL.")
        blob = self.bucket.blob(dest_path)
        
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=expiration_minutes),
            method="PUT",
            content_type=content_type,
        )
        return url

    def upload_bytes(self, data: bytes, dest_path: str, content_type: str = "application/octet-stream") -> str:
        """Uploads bytes directly to GCS or local disk and returns the URI."""
        if self.is_local:
            file_path = self.local_dir / dest_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(data)
            return f"local://{dest_path}"

        blob = self.bucket.blob(dest_path)
        blob.upload_from_string(data, content_type=content_type)
        return f"gs://{settings.gcs_bucket_name}/{dest_path}"

    def download_as_bytes(self, src_path: str) -> bytes:
        """Downloads an object from GCS or local disk to memory."""
        if self.is_local or src_path.startswith("local://"):
            dest_path = src_path.replace("local://", "") if src_path.startswith("local://") else src_path
            # In cases where HTTP URL is passed in local dev (like uploading from frontend, it echoes back the signed url's PUT resolution? Wait, frontend sends the final URI)
            # Let's adjust if needed. But assuming `local://...` is used for `gs_uri` conceptually in helpers:
            file_path = self.local_dir / dest_path
            with open(file_path, "rb") as f:
                return f.read()

        if src_path.startswith("gs://"):
            parsed = urllib.parse.urlparse(src_path)
            # Example gs://bucket-name/path/to/object
            # parsed.netloc is bucket-name, parsed.path is /path/to/object
            bucket = self.client.bucket(parsed.netloc)
            blob_name = parsed.path.lstrip('/')
            blob = bucket.blob(blob_name)
        else:
            blob = self.bucket.blob(src_path)
        
        return blob.download_as_bytes()

storage_svc = StorageService()
