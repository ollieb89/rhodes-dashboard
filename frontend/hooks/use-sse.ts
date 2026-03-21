"use client";

import { useState, useEffect, useRef } from "react";

export interface SSEEvent {
  type: string;
  data: unknown;
}

export interface UseSSEReturn {
  connected: boolean;
  lastEvent: SSEEvent | null;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

/**
 * EventSource hook with automatic reconnection.
 *
 * @param sseUrl - SSE endpoint URL
 * @param eventTypes - Optional list of named event types to track.
 *   Named SSE events (with `event: X\n`) do not fire `onmessage`; they must
 *   be subscribed with `addEventListener`. Pass the event types you want to
 *   capture so they appear in `lastEvent`.
 */
export function useSSE(
  sseUrl: string,
  eventTypes: string[] = []
): UseSSEReturn {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);
  const sourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    retriesRef.current = 0;

    function connect() {
      if (!mountedRef.current) return;

      const es = new EventSource(sseUrl);
      sourceRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        retriesRef.current = 0;
        setConnected(true);
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        es.close();
        sourceRef.current = null;
        setConnected(false);

        retriesRef.current += 1;
        if (retriesRef.current >= MAX_RETRIES) {
          // Max retries reached — stop reconnecting, stay disconnected
          return;
        }
        timeoutRef.current = setTimeout(connect, RETRY_DELAY_MS);
      };

      // Generic unnamed messages
      es.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          setLastEvent({ type: "message", data: JSON.parse(event.data) });
        } catch {
          setLastEvent({ type: "message", data: event.data });
        }
      };

      // Named event types
      for (const type of eventTypes) {
        es.addEventListener(type, (event) => {
          if (!mountedRef.current) return;
          const msgEvent = event as MessageEvent;
          try {
            setLastEvent({ type, data: JSON.parse(msgEvent.data) });
          } catch {
            setLastEvent({ type, data: msgEvent.data });
          }
        });
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      sourceRef.current?.close();
      sourceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseUrl]);

  return { connected, lastEvent };
}
