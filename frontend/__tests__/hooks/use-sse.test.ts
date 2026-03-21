import { renderHook, act } from "@testing-library/react";
import { useSSE } from "@/hooks/use-sse";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock EventSource — no auto-open, test controls everything
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener() {}
  removeEventListener() {}

  close() {
    this.readyState = 2;
  }

  // Test helper: simulate error
  _triggerError() {
    this.readyState = 2;
    this.onerror?.();
  }

  // Test helper: simulate open
  _triggerOpen() {
    this.readyState = 1;
    this.onopen?.();
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useSSE", () => {
  it("starts disconnected then connects on open", async () => {
    const { result } = renderHook(() =>
      useSSE({ url: "http://localhost:8521/api/sse" })
    );
    expect(result.current.connected).toBe(false);

    await act(async () => {
      MockEventSource.instances[0]._triggerOpen();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.fallback).toBe(false);
  });

  it("enters fallback after max retries", async () => {
    const { result } = renderHook(() =>
      useSSE({
        url: "http://localhost:8521/api/sse",
        maxRetries: 2,
        retryDelayMs: 100,
      })
    );

    // Fail attempt 1 (initial)
    await act(async () => {
      MockEventSource.instances[0]._triggerError();
    });

    // Advance past retryDelay so retry setTimeout fires and creates instance 2
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // Fail attempt 2
    await act(async () => {
      MockEventSource.instances[MockEventSource.instances.length - 1]._triggerError();
    });

    expect(result.current.fallback).toBe(true);
    expect(result.current.connected).toBe(false);
  });

  it("cleans up EventSource on unmount", async () => {
    const { unmount } = renderHook(() =>
      useSSE({ url: "http://localhost:8521/api/sse" })
    );

    await act(async () => {
      MockEventSource.instances[0]._triggerOpen();
    });

    const instance = MockEventSource.instances[0];
    unmount();
    expect(instance.readyState).toBe(2);
  });
});
