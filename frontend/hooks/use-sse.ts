"use client";

import { useState, useEffect, useRef } from "react";

interface SSEEvent {
  type: string;
  data: unknown;
}

interface UseSSEReturn {
  connected: boolean;
  lastEvent: SSEEvent | null;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export function useSSE(sseUrl: string): UseSSEReturn {
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
          // Max retries reached — stop reconnecting
          return;
        }
        timeoutRef.current = setTimeout(connect, RETRY_DELAY_MS);
      };

      es.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ type: "message", data });
        } catch {
          setLastEvent({ type: "message", data: event.data });
        }
      };

      // Proxy named events via a generic listener approach.
      // We handle named events by wrapping with a custom event proxy on the
      // EventSource. Named events (with `event: X` in SSE) don't fire onmessage,
      // so we listen to the raw EventSource events via a message-level proxy.
      // Note: EventSource only allows adding listeners by name; we use a
      // wildcard approach by overriding addEventListener on the EventSource.
      const originalAddEventListener = es.addEventListener.bind(es);
      // Intercept any named event that is dispatched on this EventSource
      // by listening for the underlying MessageEvent.
      // Since we can't enumerate SSE event types in advance, we proxy by
      // patching dispatchEvent.
      const originalDispatchEvent = es.dispatchEvent.bind(es);
      es.dispatchEvent = (event: Event): boolean => {
        if (mountedRef.current && event.type !== "open" && event.type !== "error" && event.type !== "message") {
          const msgEvent = event as MessageEvent;
          try {
            const data = JSON.parse(msgEvent.data);
            setLastEvent({ type: event.type, data });
          } catch {
            setLastEvent({ type: event.type, data: (event as MessageEvent).data });
          }
        }
        return originalDispatchEvent(event);
      };
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
  }, [sseUrl]);

  return { connected, lastEvent };
}
