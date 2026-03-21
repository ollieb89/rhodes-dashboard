"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Keyboard shortcuts: press 'g' then a letter within 1s
// g o → Overview (/)
// g p → Products (/products)
// g c → Content (/content)
// g a → Agents (/agents)
// g m → Metrics (/metrics)
// g i → Incidents (/incidents)

const SHORTCUTS: Record<string, string> = {
  o: "/",
  p: "/products",
  c: "/content",
  a: "/agents",
  m: "/metrics",
  i: "/incidents",
};

export function useKeyboardNav() {
  const router = useRouter();
  const pendingG = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const key = e.key.toLowerCase();

      if (pendingG.current) {
        // Second key in the chord
        pendingG.current = false;
        if (timer.current) clearTimeout(timer.current);
        const dest = SHORTCUTS[key];
        if (dest) {
          router.push(dest);
        }
        return;
      }

      if (key === "g") {
        pendingG.current = true;
        // Reset if second key not pressed within 1s
        timer.current = setTimeout(() => {
          pendingG.current = false;
        }, 1000);
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);
}
