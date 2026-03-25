"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "dashboard-layout";
const DEFAULT_ORDER = ["profile", "stats", "cron-health", "delivery-health", "recent-repos", "activity"];

export function useLayout() {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrder(parsed);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const moveCard = useCallback((fromIndex: number, toIndex: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setOrder(DEFAULT_ORDER);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { order, moveCard, resetLayout };
}
