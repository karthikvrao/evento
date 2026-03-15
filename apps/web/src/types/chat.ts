// Server → client
export interface WsAgentMessage {
  type: 'message';
  author: string;
  text: string;                      // Prose (markdown-renderable)
  media_refs?: MediaRef[];           // Linked to content cards via asset_id
}

export interface MediaRef {
  asset_id: string;                  // Firestore doc ID = ContentCard ID
  url: string;
  thumbnail_url?: string;
  mime_type: string;
  asset_type: 'image' | 'video' | 'document';
}

// Client → server (supports multiple attachments)
export interface WsUserMessage {
  text: string;
  attachments?: Attachment[];        // Zero or more files
}

export interface Attachment {
  url: string;                       // GCS URL after upload
  mime_type: string;                 // "image/jpeg", "application/pdf", etc.
}
