"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Bot,
  Clock,
  RefreshCw,
  Play,
  PauseCircle,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Pause,
  Trash2,
  Terminal,
  Info,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { AgentDrawer } from "@/components/agent-drawer";
import { UpdatedAgo } from "@/components/updated-ago";
import { apiFetch, apiUrl } from "@/lib/api";

const MAX_LOG_LINES = 200;

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

interface TimelineRun {
  id: string;
  name: string;
  started_at: string;
  ended_at: string;
  status: string;
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

const TIMELINE_HOURS = [
  { label: "6h", value: 6 },
  { label: "24h", value: 24 },
  { label: "7d", value: 168 },
];

function statusColor(status: string): string {
  if (status === "success") return "#22c55e";
  if (status === "error") return "#ef4444";
  if (status === "running" || status === "in-progress") return "#f59e0b";
  return "#52525b";
}

function TimelineChart({ runs, hours }: { runs: TimelineRun[]; hours: number }) {
  const windowStartMs = Date.now() - hours * 3600 * 1000;

  const chartData = runs.map((run) => {
    const startMs = new Date(run.started_at).getTime();
    const endMs = new Date(run.ended_at).getTime();
    return {
      name: run.name,
      gap: Math.max(0, startMs - windowStartMs),
      duration: Math.max(60_000, endMs - startMs),
      status: run.status,
      startMs,
      endMs,
    };
  });

  const totalMs = hours * 3600 * 1000;

  const formatTick = (ms: number) => {
    const d = new Date(windowStartMs + ms);
    if (hours <= 24) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <ResponsiveContainer width="100%" height={Math.max(80, chartData.length * 28 + 40)}>
      <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 20 }}>
        <XAxis
          type="number"
          domain={[0, totalMs]}
          tickFormatter={formatTick}
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={false}
          tickLine={false}
          tickCount={5}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
          width={130}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload.find((p) => p.dataKey === "duration")?.payload;
            if (!d) return null;
            return (
              <div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs space-y-1 shadow-lg">
                <p className="text-zinc-200 font-medium">{d.name}</p>
                <p className="text-zinc-400">Start: {new Date(d.startMs).toLocaleTimeString()}</p>
                <p className="text-zinc-400">End: {new Date(d.endMs).toLocaleTimeString()}</p>
                <p className="text-zinc-400">
                  Status:{" "}
                  <span style={{ color: statusColor(d.status) }}>{d.status}</span>
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="gap" stackId="a" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="duration" stackId="a" isAnimationActive={false} radius={[2, 2, 2, 2]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={statusColor(entry.status)} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LogPanel() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const pausedRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const linesRef = useRef<string[]>([]);

  const appendLine = useCallback((line: string) => {
    if (pausedRef.current) return;
    linesRef.current = [...linesRef.current, line].slice(-MAX_LOG_LINES);
    setLines([...linesRef.current]);
  }, []);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }
    const es = new EventSource(apiUrl("/api/logs/stream"));
    esRef.current = es;
    setConnected(false);
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      setConnected(true);
      appendLine(e.data);
    };
    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(() => {
        if (esRef.current === es) connect();
      }, 5000);
    };
  }, [appendLine]);

  useEffect(() => {
    if (!open) return;
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [open, connect]);

  useEffect(() => {
    if (!paused && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [lines, paused]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
  };

  const clearLogs = () => {
    linesRef.current = [];
    setLines([]);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <Terminal className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-300">Live Logs</span>
        {open && (
          <span
            className={`ml-2 w-2 h-2 rounded-full shrink-0 ${connected ? "bg-green-500 animate-pulse" : "bg-zinc-600"}`}
            title={connected ? "Connected" : "Connecting..."}
          />
        )}
        <span className="ml-auto text-xs text-zinc-500">
          {open ? "cron run history via SSE" : "click to expand"}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>
      {open && (
        <>
          <div className="flex items-center gap-2 px-4 py-2 border-t border-zinc-800 bg-zinc-900/80">
            <button
              onClick={togglePause}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                paused
                  ? "border-green-700/50 text-green-400 hover:border-green-600"
                  : "border-zinc-700 text-zinc-400 hover:border-amber-700 hover:text-amber-400"
              }`}
            >
              {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
            </button>
            <button
              onClick={clearLogs}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:border-red-700 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
            <span className="ml-auto text-[10px] text-zinc-600">
              {lines.length} lines / {MAX_LOG_LINES}
              {paused && <span className="ml-2 text-amber-500 font-medium">PAUSED</span>}
            </span>
          </div>
          <pre
            ref={preRef}
            className="h-72 overflow-y-auto font-mono text-[11px] text-green-400/90 bg-zinc-950 p-4 leading-relaxed whitespace-pre-wrap break-all"
          >
            {lines.length === 0 ? (
              <span className="text-zinc-600">
                {connected ? "Waiting for log entries..." : "Connecting to log stream..."}
              </span>
            ) : (
              lines.join("\n")
            )}
          </pre>
        </>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const [runMessages, setRunMessages] = useState<Record<string, RunMsg>>({});
  const [toggleStates, setToggleStates] = useState<Record<string, ToggleState>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [timelineRuns, setTimelineRuns] = useState<TimelineRun[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineHours, setTimelineHours] = useState(24);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/agents").then((r) => r.json()),
      apiFetch("/api/history?days=7").then((r) => r.json()).catch(() => null),
    ])
      .then(([d, hist]) => {
        setAgents(d.agents ?? []);
        setError(d.error ?? null);
        if (hist) setHistory(hist.snapshots ?? hist ?? []);
      })
      .catch(() => setError("Backend unavailable"))
      .finally(() => { setLoading(false); setLastRefresh(Date.now()); });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const loadTimeline = useCallback((h: number) => {
    setTimelineLoading(true);
    apiFetch(`/api/crons/runs/timeline?hours=${h}`)
      .then((r) => r.json())
      .then((d) => setTimelineRuns(d.runs ?? []))
      .catch(() => setTimelineRuns([]))
      .finally(() => setTimelineLoading(false));
  }, []);

  useEffect(() => {
    loadTimeline(timelineHours);
  }, [timelineHours, loadTimeline]);

  const runAgent = async (id: string) => {
    setRunStates((prev) => ({ ...prev, [id]: "running" }));
    try {
      const res = await apiFetch("/api/crons/${id}/run", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) {
        setRunStates((prev) => ({ ...prev, [id]: "success" }));
        setRunMessages((prev) => ({ ...prev, [id]: { text: data.output ?? "Started", state: "success" } }));
      } else {
        setRunStates((prev) => ({ ...prev, [id]: "error" }));
        setRunMessages((prev) => ({ ...prev, [id]: { text: data.error ?? `Error ${res.status}`, state: "error" } }));
      }
    } catch {
      setRunStates((prev) => ({ ...prev, [id]: "error" }));
      setRunMessages((prev) => ({ ...prev, [id]: { text: "Network error", state: "error" } }));
    }
    setTimeout(() => {
      setRunStates((prev) => ({ ...prev, [id]: "idle" }));
      setRunMessages((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }, 5000);
  };

  const toggleAgent = async (id: string, currentStatus: string) => {
    const isActive = currentStatus === "active" || currentStatus === "running";
    const action = isActive ? "disable" : "enable";
    setToggleStates((prev) => ({ ...prev, [id]: "loading" }));
    try {
      await apiFetch("/api/crons/${id}/${action}", { method: "POST" });
    } catch { /* best-effort */ } finally {
      setToggleStates((prev) => ({ ...prev, [id]: "idle" }));
      load();
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">Agents</h1>
            <p className="text-sm text-zinc-500 mt-1">OpenClaw cron jobs ({agents.length} found)</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {error && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        {history.length > 1 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Agent count — 7 day trend</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={history.map((h) => ({ value: h.total_agents, label: new Date(h.timestamp).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) }))}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#52525b" }} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200">{payload[0].payload.label}: {payload[0].value} agents</div> : null} />
                  <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={1.5} dot={{ r: 2, fill: "#a78bfa", strokeWidth: 0 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        <ErrorBoundary>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Execution timeline</CardTitle>
                <div className="flex items-center gap-1">
                  {TIMELINE_HOURS.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => setTimelineHours(value)}
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                        timelineHours === value
                          ? "bg-violet-600/30 text-violet-300"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {timelineLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 bg-zinc-800 rounded" />
                  ))}
                </div>
              ) : timelineRuns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-zinc-500">
                  <p className="text-sm">No run history found for this time range</p>
                </div>
              ) : (
                <TimelineChart runs={timelineRuns} hours={timelineHours} />
              )}
            </CardContent>
          </Card>
        </ErrorBoundary>
        {!loading && agents.length > 0 && (
          <div className="hidden md:grid grid-cols-[1fr_130px_90px_90px_auto] gap-4 px-4 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <span>Name</span><span>Schedule</span><span>Status</span><span>Last Run</span><span>Actions</span>
          </div>
        )}
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 bg-zinc-800 rounded-xl" />)}</div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
            <Bot className="w-8 h-8 mb-2" />
            <p className="text-sm">No cron jobs found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => {
              const runState = runStates[agent.id] ?? "idle";
              const runMsg = runMessages[agent.id];
              const isActive = (agent.status || "").toLowerCase() === "active" || (agent.status || "").toLowerCase() === "running";
              const toggling = toggleStates[agent.id] === "loading";
              return (
                <Card key={agent.id} className="bg-zinc-900 border-zinc-800">
                  <CardContent className="px-4 py-3 space-y-2">
                    <div className="flex flex-col gap-2 md:grid md:grid-cols-[1fr_130px_90px_90px_auto] md:gap-4 md:items-center">
                      <span className="text-sm text-zinc-200 font-medium truncate">{agent.name || agent.id}</span>
                      <span className="flex items-center gap-1.5 font-mono text-xs text-violet-400">
                        <Clock className="w-3 h-3 shrink-0" />{agent.schedule || "—"}
                      </span>
                      <Badge className={`text-[10px] border-0 w-fit ${statusBadgeClass(agent.status || "")}`}>{agent.status || "—"}</Badge>
                      <span className="text-xs text-zinc-400">{timeAgo(agent.last_run)}</span>
                      <div className="flex items-center gap-2">
                        {runMsg && <span className={`text-xs truncate max-w-[120px] ${runMsg.state === "success" ? "text-green-400" : "text-red-400"}`} title={runMsg.text}>{runMsg.text}</span>}
                        <button onClick={() => runAgent(agent.id)} disabled={runState === "running"} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-violet-700 hover:text-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                          {runState === "running" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          {runState === "running" ? "Running..." : "Run now"}
                        </button>
                        <button onClick={() => toggleAgent(agent.id, agent.status || "")} disabled={toggling} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${isActive ? "border-amber-700/50 text-amber-400 hover:border-amber-600 hover:bg-amber-950/20" : "border-green-700/50 text-green-400 hover:border-green-600 hover:bg-green-950/20"}`}>
                          {toggling ? <RefreshCw className="w-3 h-3 animate-spin" /> : isActive ? <PauseCircle className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                          {toggling ? "..." : isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </div>
                    <details className="group">
                      <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-500 select-none list-none flex items-center gap-1">
                        <span className="group-open:hidden">▶</span><span className="hidden group-open:inline">▼</span> Raw data
                      </summary>
                      <pre className="mt-1.5 text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-all bg-zinc-800/50 rounded-lg p-2.5">{JSON.stringify(agent, null, 2)}</pre>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <LogPanel />
        <p className="text-xs text-zinc-600">Last refreshed: {new Date(lastRefresh).toLocaleTimeString()} · auto-refreshes every 30 s</p>
      </div>
      <AgentDrawer
        agentId={selectedAgentId}
        onClose={() => setSelectedAgentId(null)}
        onAction={load}
      />
    </ErrorBoundary>
  );
}
