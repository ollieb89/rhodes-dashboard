"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, Clock, RefreshCw, Play, PauseCircle, PlayCircle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";

const API = "http://localhost:8521";

interface Agent {
  id: string;
  name: string;
  schedule: string;
  status: string;
  last_run: string | null;
  next_run: string | null;
}


interface HistorySnapshot {
  timestamp: string;
  total_agents: number;
}

type RunState = "idle" | "running" | "success" | "error";
type ToggleState = "idle" | "loading";

interface RunMsg {
  text: string;
  state: "success" | "error";
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "running") return "bg-green-500/20 text-green-400";
  if (s === "paused") return "bg-amber-500/20 text-amber-400";
  return "bg-zinc-500/20 text-zinc-400";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const [runMessages, setRunMessages] = useState<Record<string, RunMsg>>({});
  const [toggleStates, setToggleStates] = useState<Record<string, ToggleState>>({});
  const [history, setHistory] = useState<HistorySnapshot[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/agents`).then((r) => r.json()),
      fetch(`${API}/api/history?days=7`).then((r) => r.json()).catch(() => null),
    ])
      .then(([d, hist]) => {
        setAgents(d.agents ?? []);
        setError(d.error ?? null);
        if (hist) setHistory(hist.snapshots ?? hist ?? []);
      })
      .catch(() => setError("Backend unavailable"))
      .finally(() => {
        setLoading(false);
        setLastRefresh(Date.now());
      });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const runAgent = async (id: string) => {
    setRunStates((prev) => ({ ...prev, [id]: "running" }));
    try {
      const res = await fetch(`${API}/api/crons/${id}/run`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) {
        setRunStates((prev) => ({ ...prev, [id]: "success" }));
        setRunMessages((prev) => ({
          ...prev,
          [id]: { text: data.output ?? "Started", state: "success" },
        }));
      } else {
        setRunStates((prev) => ({ ...prev, [id]: "error" }));
        setRunMessages((prev) => ({
          ...prev,
          [id]: { text: data.error ?? `Error ${res.status}`, state: "error" },
        }));
      }
    } catch {
      setRunStates((prev) => ({ ...prev, [id]: "error" }));
      setRunMessages((prev) => ({
        ...prev,
        [id]: { text: "Network error", state: "error" },
      }));
    }
    setTimeout(() => {
      setRunStates((prev) => ({ ...prev, [id]: "idle" }));
      setRunMessages((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }, 5000);
  };


  const toggleAgent = async (id: string, currentStatus: string) => {
    const isActive = currentStatus === "active" || currentStatus === "running";
    const action = isActive ? "disable" : "enable";
    setToggleStates((prev) => ({ ...prev, [id]: "loading" }));
    try {
      await fetch(`${API}/api/crons/${id}/${action}`, { method: "POST" });
    } catch {
      // best-effort
    } finally {
      setToggleStates((prev) => ({ ...prev, [id]: "idle" }));
      load();
    }
  };

  return (
    <ErrorBoundary>
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Agents</h1>
          <p className="text-sm text-zinc-500 mt-1">
            OpenClaw cron jobs ({agents.length} found)
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}


      {/* Agent count over time */}
      {history.length > 1 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Agent count — 7 day trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={history.map((h) => ({
                value: h.total_agents,
                label: new Date(h.timestamp).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
              }))}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#52525b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.length) {
                      return (
                        <div className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200">
                          {payload[0].payload.label}: {payload[0].value} agents
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#a78bfa"
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: "#a78bfa", strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Column labels */}
      {!loading && agents.length > 0 && (
        <div className="grid grid-cols-[1fr_130px_90px_90px_auto] gap-4 px-4 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          <span>Name</span>
          <span>Schedule</span>
          <span>Status</span>
          <span>Last Run</span>
          <span>Actions</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
          <Bot className="w-8 h-8 mb-2" />
          <p className="text-sm">No cron jobs found</p>
          <p className="text-xs mt-1 text-zinc-600">
            Run <code className="font-mono">openclaw cron list</code> manually to debug
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => {
            const runState = runStates[agent.id] ?? "idle";
            const runMsg = runMessages[agent.id];
            return (
              <Card key={agent.id} className="bg-zinc-900 border-zinc-800">
                <CardContent className="px-4 py-3 space-y-2">
                  {/* Main row */}
                  <div className="grid grid-cols-[1fr_130px_90px_90px_auto] gap-4 items-center">
                    {/* Name */}
                    <span className="text-sm text-zinc-200 font-medium truncate">
                      {agent.name || agent.id}
                    </span>

                    {/* Schedule */}
                    <span className="flex items-center gap-1.5 font-mono text-xs text-violet-400">
                      <Clock className="w-3 h-3 shrink-0" />
                      {agent.schedule || "—"}
                    </span>

                    {/* Status */}
                    <Badge
                      className={`text-[10px] border-0 w-fit ${statusBadgeClass(agent.status || "")}`}
                    >
                      {agent.status || "—"}
                    </Badge>

                    {/* Last Run */}
                    <span className="text-xs text-zinc-400">
                      {timeAgo(agent.last_run)}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {runMsg && (
                        <span
                          className={`text-xs truncate max-w-[120px] ${
                            runMsg.state === "success" ? "text-green-400" : "text-red-400"
                          }`}
                          title={runMsg.text}
                        >
                          {runMsg.text}
                        </span>
                      )}
                      <button
                        onClick={() => runAgent(agent.id)}
                        disabled={runState === "running"}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-violet-700 hover:text-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {runState === "running" ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        {runState === "running" ? "Running…" : "Run now"}
                      </button>
                      {(() => {
                        const isActive = (agent.status || "").toLowerCase() === "active" || (agent.status || "").toLowerCase() === "running";
                        const toggling = toggleStates[agent.id] === "loading";
                        return (
                          <button
                            onClick={() => toggleAgent(agent.id, agent.status || "")}
                            disabled={toggling}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                              isActive
                                ? "border-amber-700/50 text-amber-400 hover:border-amber-600 hover:bg-amber-950/20"
                                : "border-green-700/50 text-green-400 hover:border-green-600 hover:bg-green-950/20"
                            }`}
                          >
                            {toggling ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : isActive ? (
                              <PauseCircle className="w-3 h-3" />
                            ) : (
                              <PlayCircle className="w-3 h-3" />
                            )}
                            {toggling ? "…" : isActive ? "Disable" : "Enable"}
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Collapsible raw data */}
                  <details className="group">
                    <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-500 select-none list-none flex items-center gap-1">
                      <span className="group-open:hidden">▶</span>
                      <span className="hidden group-open:inline">▼</span>
                      Raw data
                    </summary>
                    <pre className="mt-1.5 text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-all bg-zinc-800/50 rounded-lg p-2.5">
                      {JSON.stringify(agent, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-zinc-600">
        Last refreshed: {new Date(lastRefresh).toLocaleTimeString()} · auto-refreshes every 30 s
      </p>
    </div>
    </ErrorBoundary>
  );
}
