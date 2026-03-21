/**
 * Centralized API fetch helper.
 * - Resolves /api/* paths to backend URL
 * - Attaches x-dashboard-key header when NEXT_PUBLIC_DASHBOARD_API_KEY is set
 * - Applies timeout (default 15s)
 */

const API_KEY = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY ?? "";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8521";

function buildHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {};
  if (API_KEY) {
    headers["x-dashboard-key"] = API_KEY;
  }
  if (extra) {
    const extraHeaders = new Headers(extra);
    extraHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }
  return headers;
}

/** Resolve a relative API path to a full URL. */
export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

/**
 * Fetch wrapper with auth, timeout, and path resolution.
 * Usage: apiFetch("/api/products").then(r => r.json())
 */
export function apiFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = 15_000, ...fetchInit } = init ?? {};
  const url = apiUrl(path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    ...fetchInit,
    headers: buildHeaders(fetchInit.headers),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}
