/**
 * Centralized API fetch helper.
 * Automatically attaches x-dashboard-key header when
 * NEXT_PUBLIC_DASHBOARD_API_KEY environment variable is set.
 */

const API_KEY = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY ?? "";

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

export function apiFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: buildHeaders(init?.headers),
  });
}

export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8521";
  return `${base}${path}`;
}
