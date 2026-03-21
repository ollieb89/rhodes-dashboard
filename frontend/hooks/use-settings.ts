"use client";

import { useState, useEffect, useCallback } from "react";

export interface DashboardSettings {
  apiUrl: string;
  refreshInterval: number; // seconds
  theme: "light" | "dark" | "system";
}

const STORAGE_KEY = "rhodes-dashboard-settings";

const DEFAULTS: DashboardSettings = {
  apiUrl: "http://localhost:8521",
  refreshInterval: 30,
  theme: "dark",
};

function loadSettings(): DashboardSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<DashboardSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettingsState(loadSettings());
    setLoaded(true);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<DashboardSettings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // storage full or unavailable
        }
        return next;
      });
    },
    []
  );

  const resetSettings = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSettingsState(DEFAULTS);
  }, []);

  return { settings, updateSettings, resetSettings, loaded, defaults: DEFAULTS };
}
