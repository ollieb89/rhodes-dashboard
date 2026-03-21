"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { X, Trash2, Bell, RefreshCw, AlertCircle, Info, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const API = "http://localhost:8521";
const STORAGE_KEY = "notifications_last_seen_ts";

interface Event {
  id: string;
  timestamp: string;
  type: string;
  text: string;
  level: string;
}

function levelIcon(level: string) {
  if (level === "error") return <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />;
  if (level === "warn") return <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />;
  if (level === "config") return <Settings className="w-3 h-3 text-zinc-400 shrink-0" />;
  return <Info className="w-3 h-3 text-blue-400 shrink-0" />;
}

function levelBadge(level: string) {
  if (level === "error") return "bg-red-950/40 text-red-400 border-red-800/40";
  if (level === "warn") return "bg-amber-950/40 text-amber-400 border-amber-800/40";
  return "bg-zinc-800/60 text-zinc-400 border-zinc-700/40";
}

function fmtTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ts.slice(0, 16); }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/events?limit=30`);
      const data = await res.json();
      const evts: Event[] = data.events ?? [];
      setEvents(evts);
      if (!open) {
        const lastSeen = parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);
        const newCount = evts.filter((e) => new Date(e.timestamp).getTime() > lastSeen).length;
        setUnread(newCount);
      }
    } catch {
      // backend offline - keep state
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 60_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const openPanel = () => {
    setOpen(true);
    setUnread(0);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  const closePanel = () => setOpen(false);

  const clearAll = async () => {
    try {
      await fetch(`${API}/api/events/clear`, { method: "POST" });
      setEvents([]);
      setUnread(0);
    } catch { /* noop */ }
  };

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) closePanel();
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      {/* Bell button */}
      <button
        onClick={open ? closePanel : openPanel}
        className="relative flex items-center justify-center w-6 h-6 text-zinc-400 hover:text-zinc-200 transition-colors"
        title="Notifications"
        aria-label="Toggle notifications"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Slide-in panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/20" onClick={closePanel} />
          {/* Panel */}
          <div
            ref={panelRef}
            className="fixed top-7 right-0 z-50 w-80 h-[calc(100vh-28px)] bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-200">Events</span>
                {loading && <RefreshCw className="w-3 h-3 text-zinc-500 animate-spin" />}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-red-950/20"
                  title="Clear all events"
                >
                  <Trash2 className="w-3 h-3" /> Clear all
                </button>
                <button onClick={closePanel} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Event list */}
            <div className="flex-1 overflow-y-auto">
              {loading && events.length === 0 ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 bg-zinc-800 rounded-lg" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
                  <Bell className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No events yet</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {events.map((evt) => (
                    <div key={evt.id} className="px-4 py-3 hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-start gap-2">
                        {levelIcon(evt.level)}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-300 leading-relaxed break-words line-clamp-3">{evt.text}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[9px] px-1 py-0.5 rounded border ${levelBadge(evt.level)}`}>{evt.type}</span>
                            <span className="text-[10px] text-zinc-600">{fmtTime(evt.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-zinc-800 shrink-0">
              <p className="text-[10px] text-zinc-600">{events.length} events · ESC to close</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
