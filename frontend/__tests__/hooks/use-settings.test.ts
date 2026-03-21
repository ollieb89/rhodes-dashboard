import { renderHook, act } from "@testing-library/react";
import { useSettings } from "@/hooks/use-settings";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage
const store: Record<string, string> = {};
const mockStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal("localStorage", mockStorage);
});

describe("useSettings", () => {
  it("returns defaults when localStorage is empty", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.apiUrl).toBe("http://localhost:8521");
    expect(result.current.settings.refreshInterval).toBe(30);
    expect(result.current.settings.theme).toBe("dark");
  });

  it("loads saved settings from localStorage", () => {
    store["rhodes-dashboard-settings"] = JSON.stringify({
      apiUrl: "http://custom:9000",
      refreshInterval: 60,
    });
    const { result } = renderHook(() => useSettings());
    // After the useEffect fires
    expect(result.current.settings.apiUrl).toBe("http://custom:9000");
    expect(result.current.settings.refreshInterval).toBe(60);
    expect(result.current.settings.theme).toBe("dark"); // default
  });

  it("updateSettings persists to localStorage", () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.updateSettings({ refreshInterval: 120 });
    });
    expect(result.current.settings.refreshInterval).toBe(120);
    expect(mockStorage.setItem).toHaveBeenCalled();
    const saved = JSON.parse(store["rhodes-dashboard-settings"]);
    expect(saved.refreshInterval).toBe(120);
  });

  it("resetSettings clears localStorage and restores defaults", () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.updateSettings({ apiUrl: "http://custom:9000" });
    });
    expect(result.current.settings.apiUrl).toBe("http://custom:9000");

    act(() => {
      result.current.resetSettings();
    });
    expect(result.current.settings.apiUrl).toBe("http://localhost:8521");
    expect(mockStorage.removeItem).toHaveBeenCalledWith("rhodes-dashboard-settings");
  });
});
