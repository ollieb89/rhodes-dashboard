"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

export function useFetchWithTimestamp<T>(
  url: string,
  transform?: (raw: unknown) => T,
  intervalMs = 0
): FetchState<T> & { refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [updatedAgo, setUpdatedAgo] = useState("just now");
  const mountedRef = useRef(true);

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
  useEffect(() => {
    doFetch();
    if (intervalMs > 0) {
      const iv = setInterval(doFetch, intervalMs);
      return () => clearInterval(iv);
    }
  }, [doFetch, intervalMs]);

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

  return { data, loading, error, fetchedAt, updatedAgo, refresh: doFetch };
}
