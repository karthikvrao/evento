# Fixing Scroll and User Image Uploads

## Goal
1. Make the center content area auto-scroll like the AI chat panel.
2. Enable users to upload images that appear in their chat bubble, get persisted as media assets, and are visible after page refresh.

---

## Proposed Changes

### Fix 1: Center Area Scroll

#### [MODIFY] [EventSpacePage.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/pages/EventSpacePage.tsx)
- Switch main content area to `flex-col-reverse` logic to ensure new assets appear at the bottom and the view stays "stuck" to the latest content.
- Update `groupedContent` mapping to be reverse-chronological.
- Change loading message from 'Generating content' to 'Analysing...' for a more generic indication of agent activity.
- Add `contentCards.length` as a dependency to the auto-scroll `useEffect` so it re-triggers on new assets.

---

### Fix 2: User Image Upload Pipeline

**End-to-end flow:**
```
User picks file → Frontend uploads to GCS via signed URL
→ Frontend calls POST /events/{event_id}/media to record asset
→ Frontend sends WS message { text, image_urls: [gs://...] }
→ Backend generates thumbnail, saves to GCS
→ Backend echoes media_refs back to frontend in WS response
→ Chat history includes media_refs for refresh persistence
```

#### [MODIFY] [AiAssistantPanel.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/eventspace/AiAssistantPanel.tsx)
- Change `onSend` signature to [(text: string, attachments: Attachment[]) => void](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/eventspace/ChatMessage.tsx#40-42).
- Pass `attachments` array to `onSend` in [handleSubmit](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/modals/CreateEventModal.tsx#37-49).

#### [MODIFY] [useEventSession.ts](file:///Volumes/Jaaga1/repos/evento/apps/web/src/hooks/useEventSession.ts)
- Add `uploadAndSendMessage(text, localFiles)` helper:
  1. For each file, call `GET /media/signed-url` to get a signed URL + `dest_path`.
  2. `PUT` the file to the signed URL.
  3. Call `POST /events/{event_id}/media` to persist the asset in Firestore (using existing [record_user_uploaded_media](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/media.py#24-54)).
  4. Collect all `gs://bucket/dest_path` URIs.
  5. Send over WS: `{ text, image_urls: ["gs://...", ...] }`.
- Show uploaded image thumbnails in the user message bubble immediately (using local preview URLs).

#### [MODIFY] [chat.py](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/chat.py)
- Update [upstream_task](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/chat.py#241-260) to parse `image_urls` (list) from the WS JSON.
- Update [downstream_task](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/api/chat.py#261-373) to loop through each URI and call [process_image()](file:///Volumes/Jaaga1/repos/evento/apps/agent_service/app/utils/helpers.py#60-92) → append each `Part` to the content parts list.
- After processing, generate thumbnails for each uploaded image and echo back `media_refs` in the user's message acknowledgment (so the frontend can display them on refresh).

#### [MODIFY] [ChatMessage.tsx](file:///Volumes/Jaaga1/repos/evento/apps/web/src/components/eventspace/ChatMessage.tsx)
- Already supports `mediaRefs` display. No changes needed — just ensure [useEventSession](file:///Volumes/Jaaga1/repos/evento/apps/web/src/hooks/useEventSession.ts#7-218) attaches `mediaRefs` to user messages.

---

## Verification Plan

### Manual Verification
1. **Upload:** Attach 2 images, type "use these as inspiration", click Send. Verify:
   - Images appear as thumbnails in the user's chat bubble.
   - Agent acknowledges and describes the images.
   - `/events/{eventId}/media` shows the uploaded assets.
2. **Refresh:** Reload the page. Verify user message still shows image thumbnails.
3. **Scroll:** Generate new content. Verify center area auto-scrolls to show the latest card.
