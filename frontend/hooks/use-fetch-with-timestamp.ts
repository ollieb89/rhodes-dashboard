"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSSE } from "./use-sse";

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  fetchedAt: Date | null;
  /** Relative "X ago" string, ticks every 10s without re-fetching */
  updatedAgo: string;
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Derive the SSE URL from a data URL: extract the base URL (origin) + /api/events.
 * Falls back to "/api/events" if the URL cannot be parsed as absolute.
 */
function sseUrlFromDataUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/api/events`;
  } catch {
    return "/api/events";
  }
}

export function useFetchWithTimestamp<T>(
  url: string,
  transform?: (raw: unknown) => T,
  intervalMs = 0,
  /** Optional SSE event type. When provided and SSE is connected, polling is skipped. */
  sseEventType?: string
): FetchState<T> & { refresh: () => void; sseActive: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [updatedAgo, setUpdatedAgo] = useState("just now");
  const mountedRef = useRef(true);

  // SSE integration — only active when sseEventType is provided
  const sseUrl = sseEventType ? sseUrlFromDataUrl(url) : "";
  const { connected: sseConnected, lastEvent } = useSSE(
    sseUrl,
    sseEventType ? [sseEventType] : []
  );
  const sseActive = !!sseEventType && sseConnected;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const doFetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(url);
      const raw = await res.json();
      if (!mountedRef.current) return;
      const value = transform ? transform(raw) : (raw as T);
      setData(value);
      setError(null);
      const now = new Date();
      setFetchedAt(now);
      setUpdatedAgo("just now");
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [url, transform]);

  // Initial fetch + optional polling
  // When SSE is connected and sseEventType is provided: skip polling interval
  // When SSE disconnects (sseActive becomes false): resume polling if intervalMs > 0
  const usePolling = !sseEventType || !sseConnected;

  useEffect(() => {
    doFetch();
    if (usePolling && intervalMs > 0) {
      const iv = setInterval(doFetch, intervalMs);
      return () => clearInterval(iv);
    }
  }, [doFetch, intervalMs, usePolling]);

  // Trigger a refresh when a matching SSE event fires
  useEffect(() => {
    if (!sseEventType || !lastEvent) return;
    if (lastEvent.type === sseEventType) {
      doFetch();
    }
  }, [lastEvent, sseEventType, doFetch]);

  // Tick the "X ago" label every 10s without re-fetching
  useEffect(() => {
    if (!fetchedAt) return;
    const tick = setInterval(() => {
      if (mountedRef.current && fetchedAt) {
        setUpdatedAgo(timeAgo(fetchedAt));
      }
    }, 10_000);
    return () => clearInterval(tick);
  }, [fetchedAt]);

  return { data, loading, error, fetchedAt, updatedAgo, refresh: doFetch, sseActive };
}
