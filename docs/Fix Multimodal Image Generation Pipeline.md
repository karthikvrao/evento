# Fix Multimodal Image Generation Pipeline

Align `MultimodalContentCreator` with the [hybrid approach](file:///Volumes/Jaaga1/repos/evento/docs/structured_multimodal_response_implementation_plan.md) so images are **actually generated** and processed through the asset pipeline.

## Root Cause

The current instruction tells the model to output strict JSON **and** images, which is contradictory — models either follow the JSON constraint (no images) or produce images (no valid JSON). Additionally, `generate_content_config` doesn't set `response_modalities=["TEXT", "IMAGE"]`, which is **required** to enable native image output.

## Proposed Changes

### 1. MultimodalContentCreator — Agent Config

#### [MODIFY] [multimodal_content_creator.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/multimodal_content_creator.py)

**Three changes:**

**a) Add `generate_content_config` with `response_modalities`**
```python
generate_content_config=genai_types.GenerateContentConfig(
    response_modalities=["TEXT", "IMAGE"],
)
```
Without this, the model physically cannot produce image parts.

**b) Simplify instruction — drop JSON output format**
Let the model produce natural interleaved text + images. The callback will handle structuring the output. New instruction tells the model to:
- Write all copy as markdown prose
- Generate inline images for each requested asset
- Separate sections with `---` markers so we can parse them

**c) Refactor `process_generated_images_callback`**
- Extract all text parts → concatenate as `rich_content`
- Extract all `inline_data` image parts → upload each to GCS + save to Firestore
- **Construct** the structured JSON response from extracted parts (instead of trying to parse it from model output)
- Only return modified `LlmResponse` when there are images to process; return `None` otherwise (no-op passthrough)
- Replace `asyncio.get_event_loop()` with `asyncio.get_running_loop()`
- Remove unused `import base64`

---

### 2. ContentGenerator — Synthesizer Prompt

#### [MODIFY] [content_generator.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/agents/content_generator.py)

Update synthesiser instruction line 57: remove "Mention any placeholder/stub notes" → replace with "Do NOT include image descriptions like 'Imagine a vibrant...' — the images are already generated and attached."

---

### 3. chat.py — No changes needed

The existing `chat.py` logic (lines 191–218) already:
1. Joins text parts from the final response
2. Tries `json.loads()` to extract `media_assets` → `media_refs`
3. Falls back to plain text with GCS URL replacement

This will continue to work because the callback now constructs the JSON structure.

---

## Summary of What Changes

| File | What | Why |
|------|------|-----|
| `multimodal_content_creator.py` | Add `response_modalities=["TEXT","IMAGE"]` | Required to enable image generation |
| `multimodal_content_creator.py` | Simplify instruction to prose | Stop fighting the model over JSON format |
| `multimodal_content_creator.py` | Refactor callback to construct JSON from parts | Reliable structured output without model compliance |
| `multimodal_content_creator.py` | `get_running_loop()`, remove `base64` import | Fix deprecation + cleanup |
| `content_generator.py` | Remove placeholder encouragement | Prevent "imagine a..." text in final response |

## Verification

- Run `adk web` → select "app" → request "Create a poster for a tech meetup"
- Expect: agent generates text + real images in response
- Expect: `chat.py` extracts `media_refs` from the structured JSON
- Expect: no "imagine a vibrant design" placeholder text in final output
