import json
import base64
import uuid
import asyncio
import logging
from typing import Optional
from copy import deepcopy

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse
from google.genai import types as genai_types
from app.services.storage_service import storage_svc
from app.services.firestore_service import save_media_asset, gs_to_public_url
from app.utils.helpers import resize_and_upload_image
from app.utils.constants import THUMBNAIL_MAX_WIDTH

logger = logging.getLogger(__name__)


def process_generated_images_callback(
    callback_context: CallbackContext, llm_response: LlmResponse
) -> Optional[LlmResponse]:
    """Intercepts the model's response, extracts Base64 images, uploads full + thumbnail,
    saves each as a media_asset in Firestore, and embeds asset_id metadata into the response
    so chat.py can build media_refs for the frontend.
    """
    if not llm_response.content or not llm_response.content.parts:
        return None

    response_text = llm_response.content.parts[0].text

    try:
        # 1. Parse the JSON response
        response_json = json.loads(response_text)

        if not (
            isinstance(response_json, dict)
            and response_json.get("status") == "success"
            and "data" in response_json
            and "images" in response_json["data"]
        ):
            return None

        images = response_json["data"]["images"]

        # Extract context from session state
        session_id = (
            callback_context.session.id if callback_context.session else "unknown_session"
        )
        state = callback_context.state or {}
        event_id = state.get("event_id", "unknown_event")

        # Determine content category from metadata
        metadata = response_json.get("metadata", {})
        formats_included = metadata.get("formats_included", [])
        content_category = "poster"  # default
        if "email" in formats_included:
            content_category = "email"
        elif "social_post" in formats_included:
            content_category = "social_post"

        # 2. Process each image: upload full + thumbnail, save to Firestore
        media_assets_info = []  # Will be injected into response for chat.py
        modified_image_uris = []
        modified = False

        for idx, img_data in enumerate(images):
            # Check if it looks like a base64 string or data URI
            if isinstance(img_data, str) and (
                img_data.startswith("data:image/") or ";base64," in img_data
            ):
                try:
                    # Extract the base64 part
                    if "," in img_data:
                        _, b64_str = img_data.split(",", 1)
                    else:
                        b64_str = img_data

                    image_bytes = base64.b64decode(b64_str)
                    file_stem = f"gen_{uuid.uuid4().hex[:8]}"

                    # Upload full-size image
                    full_uri = resize_and_upload_image(
                        image_bytes,
                        dest_prefix=f"generated/{event_id}/{session_id}",
                        filename=f"{file_stem}.jpg",
                    )

                    # Upload thumbnail
                    thumb_uri = resize_and_upload_image(
                        image_bytes,
                        dest_prefix=f"thumbnails/{event_id}/{session_id}",
                        max_width=THUMBNAIL_MAX_WIDTH,
                        filename=f"{file_stem}_thumb.jpg",
                    )

                    # Save to Firestore — runs async in background
                    # We use asyncio.run_coroutine_threadsafe because after_model_callback is sync
                    loop = asyncio.get_event_loop()
                    future = asyncio.run_coroutine_threadsafe(
                        save_media_asset({
                            "event_id": event_id,
                            "session_id": session_id,
                            "source": "agent_generated",
                            "asset_type": "image",
                            "subtype": None,
                            "parent_asset_id": None,
                            "gcs_path": full_uri,
                            "public_url": gs_to_public_url(full_uri),
                            "thumbnail_gcs_path": thumb_uri,
                            "thumbnail_url": gs_to_public_url(thumb_uri),
                            "content_category": content_category,
                            "title": f"{content_category.replace('_', ' ').title()} {idx + 1}",
                            "mime_type": "image/jpeg",
                            "rich_content": response_json["data"].get("text"),
                            "subject": None,
                        }),
                        loop,
                    )
                    # Wait for Firestore write to get the asset_id (with timeout)
                    asset_id = future.result(timeout=10)

                    # Collect asset info for chat.py to build media_refs
                    media_assets_info.append({
                        "asset_id": asset_id,
                        "url": gs_to_public_url(full_uri),
                        "thumbnail_url": gs_to_public_url(thumb_uri),
                        "asset_type": "image",
                        "mime_type": "image/jpeg",
                    })

                    modified_image_uris.append(gs_to_public_url(full_uri))
                    modified = True
                    logger.info(
                        f"Saved agent image asset_id={asset_id} "
                        f"full={full_uri} thumb={thumb_uri}"
                    )
                except Exception as e:
                    logger.error(f"Failed to process image {idx}: {e}")
                    modified_image_uris.append(f"error_processing_image_{idx}")
            else:
                # Not base64 — could be a description or already a URL
                modified_image_uris.append(img_data)

        if modified:
            # 3. Replace images array with public URLs and inject media_assets metadata
            response_json["data"]["images"] = modified_image_uris
            response_json["media_assets"] = media_assets_info

            # 4. Serialize back into a new LlmResponse
            new_text = json.dumps(response_json, indent=2)
            modified_parts = [deepcopy(part) for part in llm_response.content.parts]
            modified_parts[0].text = new_text

            return LlmResponse(
                content=genai_types.Content(role="model", parts=modified_parts),
                grounding_metadata=llm_response.grounding_metadata,
            )

    except json.JSONDecodeError:
        logger.warning("Agent response was not valid JSON, cannot intercept images.")
    except Exception as e:
        logger.error(f"Unexpected error in after_model_callback: {e}")

    return None


multimodal_content_creator = LlmAgent(
    name="MultimodalContentCreator",
    # Gemini model that supports interleaved text + image output.
    model="gemini-2.5-flash-image",
    description=(
        "Generates event marketing content with interleaved text and images: "
        "social posts, email copy with hero images, event posters, banners."
    ),
    # Stateless within the pipeline — reads all context from session state.
    include_contents="none",
    instruction="""\
You are an expert event marketing creative director.

## Context
- Event details: {event_info}
- Research & content plan: {research_and_plan?}
- User instructions: {user_instructions?}

## Your job
Create compelling, ready-to-publish marketing content with text AND inline
images. Produce exactly what the content plan (or user) requests.

Examples of what to generate:
- A social media post (Instagram/LinkedIn copy + matching graphic)
- An event email with a hero banner image
- A promotional poster

CRITICAL IMAGE REQUIREMENTS:
- All generated images must be of maximum **2K quality** (e.g., max 2048px on the longest side).
- You MUST adjust the image **aspect ratio** according to the presentation context:
  - 16:9 for email banners or wide website heroes
  - 1:1 or 4:5 for standard social media (Instagram, Twitter)
  - 2:3 or 3:4 for promotional posters

## Output format
Respond ONLY with a valid JSON object (no markdown fences) matching this shape:
{
  "status": "success",
  "data": {
    "text": "<all written copy, formatted with clear section headers>",
    "images": ["<description of each generated image, or base64 data URI>"]
  },
  "metadata": {
    "content_type": "written_copy_with_images",
    "formats_included": ["<list, e.g. social_post, email, poster>"],
    "image_count": <integer>,
    "tone": "<tone used, e.g. professional, energetic>",
    "notes": "<any important notes for the synthesiser>"
  }
}

If something goes wrong, return:
{"status": "error", "data": null, "metadata": {"error": "<reason>"}}
""",
    after_model_callback=process_generated_images_callback,
)
