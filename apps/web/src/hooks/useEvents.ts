/**
 * TanStack Query hooks for event-related API operations.
 *
 * Acts as the frontend "store" for server state — handles caching,
 * refetching, loading states, and optimistic updates automatically.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPost } from '../lib/api';

// ── Types matching the backend Pydantic models ─────────────────────────────

export interface EventMetadata {
  target_audience?: string;
  key_highlights?: string[];
  speakers?: string[];
  agenda_items?: string[];
  location?: string;
  contact_info?: string;
  theme?: string;
  specific_title?: string;
  tagline?: string;
  logo_urls?: Record<string, string>;
  hosts?: string[];
  specific_content_types?: string[];
  event_type?: string;
  mode?: string;
}

export interface EventItem {
  id: string;
  name?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  created_by?: string;
  updated_by?: string;
  status?: string;
  metadata?: EventMetadata;
  created_at?: string;
  updated_at?: string;
}

interface PaginatedEventsResponse {
  items: EventItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

interface InitChatResponse {
  event_id: string;
  session_id: string;
}

interface CreateEventPayload {
  name: string;
  description?: string;
  event_type?: string;
}

// ── Query Keys ─────────────────────────────────────────────────────────────
// Centralised so cache invalidation stays consistent.

export const eventKeys = {
  all: ['events'] as const,
  list: (page: number, pageSize: number) => [...eventKeys.all, 'list', page, pageSize] as const,
  detail: (id: string) => [...eventKeys.all, 'detail', id] as const,
  media: (id: string, sessionId?: string) => [...eventKeys.all, 'media', id, sessionId] as const,
  chat: (sessionId: string) => ['chat', sessionId] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's events with pagination.
 */
export function useEvents(page = 1, pageSize = 50) {
  return useQuery<PaginatedEventsResponse>({
    queryKey: eventKeys.list(page, pageSize),
    queryFn: () => apiFetch<PaginatedEventsResponse>(`/events?page=${page}&page_size=${pageSize}`),
    // Keep previous page data visible while the next page loads
    placeholderData: (prev) => prev,
  });
}

/**
 * Fetch a single event by ID.
 */
export function useEvent(eventId: string) {
  return useQuery<EventItem>({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => apiFetch<EventItem>(`/events/${eventId}`),
    enabled: !!eventId,
  });
}

/**
 * Fetch media assets for a specific event (and optionally filtered by session_id).
 */
export function useEventMedia(eventId: string, sessionId?: string) {
  return useQuery<{ media_assets: any[] }>({
    queryKey: eventKeys.media(eventId, sessionId),
    queryFn: () => {
      let path = `/events/${eventId}/media`;
      if (sessionId) {
        path += `?session_id=${sessionId}`;
      }
      return apiFetch<{ media_assets: any[] }>(path);
    },
    enabled: !!eventId,
  });
}

/**
 * Fetch chat history for a session.
 */
export function useChatHistory(sessionId: string) {
  return useQuery<{ messages: any[] }>({
    queryKey: eventKeys.chat(sessionId),
    queryFn: () => apiFetch<{ messages: any[] }>(`/chat/${sessionId}/history`),
    enabled: !!sessionId,
  });
}

/**
 * Create a new event + chat session via POST /chat/init.
 * On success, invalidates the events list cache so the new event appears.
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation<InitChatResponse, Error, CreateEventPayload>({
    mutationFn: (payload) =>
      apiPost<InitChatResponse>('/chat/init', {
        name: payload.name,
        description: payload.description,
        event_type: payload.event_type,
      }),
    onSuccess: () => {
      // Invalidate events list so the new event shows up when user navigates back
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
