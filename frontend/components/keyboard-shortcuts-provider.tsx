"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShortcutsHelpModal } from "@/components/shortcuts-help-modal";
import { isTextInputTarget } from "@/lib/is-text-input-target";
import { NAVIGATION_SHORTCUT_MAP, SHORTCUTS } from "@/lib/shortcuts";

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
}

export function KeyboardShortcutsProvider({
  children,
}: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(false);
  const pendingNavigation = useRef(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    helpOpenRef.current = helpOpen;
  }, [helpOpen]);

  useEffect(() => {
    const clearPendingNavigation = () => {
      pendingNavigation.current = false;
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    };

    const handler = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }

      if (helpOpenRef.current && event.key === "Escape") {
        event.preventDefault();
        clearPendingNavigation();
        setHelpOpen(false);
        return;
      }

      if (isTextInputTarget(event.target) || event.defaultPrevented) {
        return;
      }

      const key = event.key.toLowerCase();

      if (pendingNavigation.current) {
        clearPendingNavigation();

        if (event.metaKey || event.ctrlKey || event.altKey) {
          return;
        }

        const destination = NAVIGATION_SHORTCUT_MAP[key];
        if (destination) {
          event.preventDefault();
          router.push(destination);
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (key === "g") {
        pendingNavigation.current = true;
        pendingTimer.current = setTimeout(() => {
          pendingNavigation.current = false;
          pendingTimer.current = null;
        }, 1000);
      }
    };

    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
      clearPendingNavigation();
    };
  }, [router]);

  return (
    <>
      {children}
      <ShortcutsHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={SHORTCUTS}
      />
    </>
  );
}
