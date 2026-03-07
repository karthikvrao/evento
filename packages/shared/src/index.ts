/**
 * Shared Types and Constants for Evento
 */

// Event Categories
export const EVENT_CATEGORIES = [
  "Music",
  "Arts",
  "Food",
  "Tech",
  "Sports",
  "Other"
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];

// Event Interface
export interface EventModel {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  date: string;
  location: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// API Response Wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

// Health Check Response
export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
}

// Agent Output Types
export interface AgentContent {
  text: string;
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
    fileData?: {
      mimeType: string;
      fileUri: string;
    };
  }>;
}
