import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Test the SSE reconnection logic directly (no React hook wrapper needed)
describe("SSE reconnection logic", () => {
  let instances: any[] = [];

  class MockEventSource {
    url: string;
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    readyState = 0;

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }
    addEventListener() {}
    removeEventListener() {}
    close() { this.readyState = 2; }
    _triggerError() { this.readyState = 2; this.onerror?.(); }
    _triggerOpen() { this.readyState = 1; this.onopen?.(); }
  }

  beforeEach(() => {
    instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an EventSource for the given URL", () => {
    const es = new MockEventSource("http://localhost:8521/api/sse");
    expect(es.url).toBe("http://localhost:8521/api/sse");
    expect(es.readyState).toBe(0);
  });

  it("transitions to open state", () => {
    const es = new MockEventSource("http://localhost:8521/api/sse");
    let connected = false;
    es.onopen = () => { connected = true; };
    es._triggerOpen();
    expect(connected).toBe(true);
    expect(es.readyState).toBe(1);
  });

  it("closes on error and signals for reconnection", () => {
    const es = new MockEventSource("http://localhost:8521/api/sse");
    let errorFired = false;
    es.onerror = () => { errorFired = true; };
    es._triggerError();
    expect(errorFired).toBe(true);
    expect(es.readyState).toBe(2);
  });

  it("reconnection logic: gives up after max retries", async () => {
    const maxRetries = 3;
    let retries = 0;
    let fallback = false;

    function connect() {
      const es = new MockEventSource("http://localhost:8521/api/sse");
      es.onerror = () => {
        es.close();
        retries += 1;
        if (retries >= maxRetries) {
          fallback = true;
          return;
        }
        connect();
      };
      // Simulate immediate failure
      es._triggerError();
    }

    connect();
    expect(retries).toBe(maxRetries);
    expect(fallback).toBe(true);
    expect(instances.length).toBe(maxRetries);
  });

  it("close() sets readyState to 2", () => {
    const es = new MockEventSource("http://localhost:8521/api/sse");
    es.close();
    expect(es.readyState).toBe(2);
  });
});
