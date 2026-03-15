/**
 * Shared API utilities for authenticated requests to the Evento backend.
 *
 * Uses Firebase Auth to get the current user's ID token and injects it
 * as a Bearer token in the Authorization header.
 */
import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get the Firebase ID token for the currently signed-in user.
 * Throws if no user is signed in.
 */
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.getIdToken();
}

/**
 * Authenticated fetch wrapper — injects Authorization header automatically.
 * Throws on non-OK responses with the error detail from the backend.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAuthToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    // Try to extract a backend detail message, fall back to status text
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // response wasn't JSON — use statusText
    }
    throw new Error(`API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Shorthand for authenticated POST requests.
 */
export async function apiPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
