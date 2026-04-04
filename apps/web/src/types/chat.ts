// Server → client
export interface WsAgentMessage {
  type: 'message' | 'thinking' | 'error' | 'state_update';
  author?: string;
  text?: string;                     // Prose (markdown-renderable)
  media_refs?: MediaRef[];           // Linked to content cards via asset_id
  event_info?: any;                  // Used for state_update
}

export const ASSET_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
} as const;

export type AssetType = typeof ASSET_TYPES[keyof typeof ASSET_TYPES];

export interface MediaRef {
  asset_id: string;                  // Firestore doc ID = ContentCard ID
  url: string;
  thumbnail_url?: string;
  mime_type: string;
  asset_type: AssetType;
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
