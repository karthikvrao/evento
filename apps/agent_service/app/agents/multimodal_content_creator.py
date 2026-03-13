import json
import base64
import uuid
import logging
from typing import Optional
from copy import deepcopy

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse
from google.genai import types as genai_types
from app.services.storage_service import storage_svc

logger = logging.getLogger(__name__)

def process_generated_images_callback(callback_context: CallbackContext, llm_response: LlmResponse) -> Optional[LlmResponse]:
    """Intercepts the model's response, extracts Base64 images, uploads them, and replaces them with URIs."""
    if not llm_response.content or not llm_response.content.parts:
        return None
        
    response_text = llm_response.content.parts[0].text
    
    try:
        # 1. Parse the JSON response
        response_json = json.loads(response_text)
        
        # Check if successful and has images
        if isinstance(response_json, dict) and response_json.get("status") == "success" and "data" in response_json and "images" in response_json["data"]:
            images = response_json["data"]["images"]
            uploaded_uris = []
            
            # Extract session_id to group media correctly
            session_id = callback_context.session.id if callback_context.session else "unknown_session"
            
            # 2. Process each image
            modified = False
            for idx, img_data in enumerate(images):
                # Check if it looks like a base64 string or data URI
                if isinstance(img_data, str) and (img_data.startswith("data:image/") or ";base64," in img_data):
                    try:
                        # Extract the base64 part
                        if "," in img_data:
                            _, b64_str = img_data.split(",", 1)
                        else:
                            b64_str = img_data
                            
                        # Decode
                        image_bytes = base64.b64decode(b64_str)
                        
                        # Upload to storage
                        file_name = f"generated_image_{uuid.uuid4().hex[:8]}.jpg"
                        dest_path = f"generated/{session_id}/{file_name}"
                        
                        uri = storage_svc.upload_bytes(image_bytes, dest_path, content_type="image/jpeg")
                        uploaded_uris.append(uri)
                        modified = True
                        logger.info(f"Successfully intercepted and uploaded agent image to: {uri}")
                    except Exception as e:
                        logger.error(f"Failed to decode/upload base64 image: {e}")
                        uploaded_uris.append(f"error_processing_image_{idx}")
                else:
                    # Not base64, maybe it's just a description or failed generation
                    uploaded_uris.append(img_data)
                    
            if modified:
                # 3. Replace the images array with the uploaded URIs
                response_json["data"]["images"] = uploaded_uris
                
                # 4. Serialize back and create a new LlmResponse object with mutated text
                new_text = json.dumps(response_json, indent=2)
                
                modified_parts = [deepcopy(part) for part in llm_response.content.parts]
                modified_parts[0].text = new_text
                
                new_response = LlmResponse(
                    content=genai_types.Content(role="model", parts=modified_parts),
                    grounding_metadata=llm_response.grounding_metadata
                )
                
                return new_response
            
    except json.JSONDecodeError:
        logger.warning("Agent response was not valid JSON, cannot intercept images.")
    except Exception as e:
        logger.error(f"Unexpected error in after_model_callback: {e}")
        
    return None

multimodal_content_creator = LlmAgent(
    name="MultimodalContentCreator",
    # Gemini model that supports interleaved text + image output.
    # Update to 'gemini-3.1-flash-image-preview' when that variant is confirmed.
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

