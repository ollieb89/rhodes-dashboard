"use client";

import { useState, useCallback, useEffect } from "react";

export function usePins(namespace: string) {
  const key = `pins:${namespace}`;

  const [pins, setPins] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(key);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  // Sync to localStorage whenever pins change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify([...pins]));
    } catch { /* storage full or unavailable */ }
  }, [pins, key]);

  const toggle = useCallback((id: string) => {
    setPins((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isPinned = useCallback((id: string) => pins.has(id), [pins]);

  return { pins, toggle, isPinned };
}
