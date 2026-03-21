"use client";

import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/notification-panel";
import { apiFetch } from "@/lib/api";

const POLL_INTERVAL = 30_000;
const SLOW_THRESHOLD = 3000;

type Status = "ok" | "slow" | "offline";

const config: Record<Status, { dot: string; text: string; bar: string }> = {
  ok: {
    dot: "bg-green-400",
    text: "All systems operational",
    bar: "bg-green-950/40 border-green-900/40",
  },
  slow: {
    dot: "bg-amber-400",
    text: "Backend slow",
    bar: "bg-amber-950/60 border-amber-900/50",
  },
  offline: {
    dot: "bg-red-400",
    text: "Backend offline",
    bar: "bg-red-950/60 border-red-900/50",
  },
};

export function HealthBar() {
  const [status, setStatus] = useState<Status>("ok");

  const check = async () => {
    const start = Date.now();
    try {
      const res = await apiFetch("/api/overview", { cache: "no-store" });
      const elapsed = Date.now() - start;
      if (!res.ok) {
        setStatus("offline");
      } else if (elapsed > SLOW_THRESHOLD) {
        setStatus("slow");
      } else {
        setStatus("ok");
      }
    } catch {
      setStatus("offline");
    }
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { dot, text, bar } = config[status];

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center gap-2 py-1.5 border-b text-xs px-4 ${bar}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === "ok" ? "" : "animate-pulse"} ${dot}`} />
      <span className="text-zinc-300 flex-1 text-center">{text}</span>
      <NotificationBell />
    </div>
  );
}
