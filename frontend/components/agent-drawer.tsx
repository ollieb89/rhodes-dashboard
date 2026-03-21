"use client";

import React from "react";
import { useEffect, useState, useRef } from "react";
import {
  X, Play, PauseCircle, PlayCircle, RefreshCw,
  Clock, Bot, Cpu, Radio, ChevronRight, AlertCircle, CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const API = "http://localhost:8521";

interface RunEntry {
  ts: string;
  status: string;
  action: string;
  duration_ms: number | null;
  error: string;
  summary: string;
  model: string;
}

export interface AgentDetails {
  id: string;
  name: string;
  schedule: string;
  status: string;
  last_run: string | null;
  next_run: string | null;
  enabled: boolean;
  agent_id: string;
  description: string;
  model: string;
  delivery_channel: string;
  recent_runs: RunEntry[];
  raw: Record<string, unknown>;
  error?: string;
}

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "ok" || s === "active" || s === "running") return "bg-green-500/20 text-green-400";
  if (s === "error") return "bg-red-500/20 text-red-400";
  if (s === "paused") return "bg-amber-500/20 text-amber-400";
  return "bg-zinc-500/20 text-zinc-400";
}

interface AgentDrawerProps {
  agentId: string | null;
  onClose: () => void;
  onAction?: () => void;
}

type ActionState = "idle" | "loading" | "done";

export function AgentDrawer({ agentId, onClose, onAction }: AgentDrawerProps) {
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [runState, setRunState] = useState<ActionState>("idle");
  const [runMsg, setRunMsg] = useState("");
  const [toggleState, setToggleState] = useState<ActionState>("idle");
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    setDetails(null);
    setRunMsg("");
    fetch(`${API}/api/crons/${agentId}/details`)
      .then((r) => r.json())
      .then((d) => setDetails(d))
      .catch(() => setDetails({ error: "Failed to load" } as AgentDetails))
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    };
    if (agentId) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [agentId, onClose]);

  const runNow = async () => {
    if (!agentId) return;
    setRunState("loading");
    setRunMsg("");
    try {
      const res = await fetch(`${API}/api/crons/${agentId}/run`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      setRunMsg(d.ok !== false ? (d.output ?? "Started") : (d.error ?? "Error"));
      setRunState("done");
      onAction?.();
    } catch {
      setRunMsg("Network error");
      setRunState("done");
    }
    setTimeout(() => setRunState("idle"), 4000);
  };

  const toggleEnable = async () => {
    if (!details || !agentId) return;
    const isActive = details.status === "active" || details.status === "running";
    const action = isActive ? "disable" : "enable";
    setToggleState("loading");
    try {
      await fetch(`${API}/api/crons/${agentId}/${action}`, { method: "POST" });
      const d = await fetch(`${API}/api/crons/${agentId}/details`).then((r) => r.json());
      setDetails(d);
      onAction?.();
    } catch { /* noop */ } finally {
      setToggleState("idle");
    }
  };

  if (!agentId) return null;
  const isActive = details && (details.status === "active" || details.status === "running");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div ref={drawerRef} className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-200">{loading ? "Loading..." : (details?.name || agentId)}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 bg-zinc-800 rounded-lg" />)}</div>
          ) : details?.error ? (
            <div className="p-5 text-sm text-red-400">{details.error}</div>
          ) : details ? (
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: "Status", content: <Badge className={`text-[10px] border-0 ${statusBadgeClass(details.status)}`}>{details.status}</Badge> },
                  { label: "Schedule", content: <span className="font-mono text-xs text-violet-400">{details.schedule || "—"}</span> },
                  { label: "Last Run", content: <span className="text-xs text-zinc-400">{fmtTs(details.last_run)}</span> },
                  { label: "Next Run", content: <span className="text-xs text-zinc-400">{fmtTs(details.next_run)}</span> },
                  { label: "Agent ID", content: <span className="font-mono text-[10px] text-zinc-500 break-all">{details.agent_id || "—"}</span> },
                  { label: "Channel", content: <span className="text-xs text-zinc-400 flex items-center gap-1"><Radio className="w-3 h-3" />{details.delivery_channel || "—"}</span> },
                ] as { label: string; content: React.ReactNode }[]).map(({ label, content }) => (
                  <div key={label} className="bg-zinc-800/40 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">{label}</p>
                    {content}
                  </div>
                ))}
              </div>
              {details.model && (
                <div className="bg-zinc-800/40 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Model</p>
                  <span className="flex items-center gap-1 text-xs text-zinc-400"><Cpu className="w-3 h-3" />{details.model}</span>
                </div>
              )}
              {details.description && (
                <div className="bg-zinc-800/40 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Prompt</p>
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">{details.description}</p>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={runNow} disabled={runState === "loading"} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-violet-600 hover:text-violet-300 transition-colors disabled:opacity-50">
                  {runState === "loading" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Run now
                </button>
                <button onClick={toggleEnable} disabled={toggleState === "loading"} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${isActive ? "border-amber-700/50 text-amber-400 hover:bg-amber-950/20" : "border-green-700/50 text-green-400 hover:bg-green-950/20"}`}>
                  {toggleState === "loading" ? <RefreshCw className="w-3 h-3 animate-spin" /> : isActive ? <PauseCircle className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                  {isActive ? "Disable" : "Enable"}
                </button>
                {runMsg && <span className="text-xs text-zinc-500 truncate max-w-[180px]">{runMsg}</span>}
              </div>
              {details.recent_runs.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-2">Recent Runs</p>
                  <div className="space-y-1.5">
                    {details.recent_runs.slice(0, 8).map((run, i) => (
                      <div key={i} className="flex items-start gap-2 bg-zinc-800/30 rounded-lg px-3 py-2">
                        {run.status === "ok" ? <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 shrink-0" /> : <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-zinc-500">{fmtTs(run.ts)}</span>
                            {run.duration_ms != null && <span className="text-[10px] text-zinc-600">{fmtDuration(run.duration_ms)}</span>}
                          </div>
                          {run.error && <p className="text-[10px] text-red-400 mt-0.5 truncate">{run.error}</p>}
                          {run.summary && <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{run.summary}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <details className="group">
                <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-500 select-none list-none flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                  Raw payload
                </summary>
                <pre className="mt-2 text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-all bg-zinc-800/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {JSON.stringify(details.raw, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
        </div>
        <div className="px-5 py-3 border-t border-zinc-800 shrink-0">
          <p className="text-[10px] text-zinc-600">ID: {agentId} · ESC to close</p>
        </div>
      </div>
    </>
  );
}
