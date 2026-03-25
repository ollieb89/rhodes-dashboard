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
import { AgentGraph } from "@/components/agent-graph";

const MAX_LOG_LINES = 200;

interface Agent {
  id: string;
  name: string;
  schedule: string;
  status: string;
  last_run: string | null;
  next_run: string | null;
}

interface AgentStats {
  success_rate_7d: number;
  success_rate_30d: number;
  total_runs: number;
  failed_runs: number;
  avg_duration_s: number;
  last_success: string | null;
  last_failure: string | null;
}

interface HeatmapCell {
  date: string;
  count: number;
  success_rate: number;
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

function reliabilityBadgeClass(rate: number): string {
  if (rate >= 95) return "bg-green-500/20 text-green-400";
  if (rate >= 80) return "bg-amber-500/20 text-amber-400";
  return "bg-red-500/20 text-red-400";
}

const HEATMAP_CELL = 12;
const HEATMAP_GAP = 2;
const HEATMAP_STEP = HEATMAP_CELL + HEATMAP_GAP;
const HEATMAP_BASE = "#27272a";
const HEATMAP_GREEN = "#16a34a";
const HEATMAP_RED = "#dc2626";
const HEATMAP_LABEL_H = 16;

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function interpolateColor(base: string, target: string, t: number): string {
  const [br, bg, bb] = hexToRgb(base);
  const [tr, tg, tb] = hexToRgb(target);
  return `rgb(${Math.round(br + (tr - br) * t)},${Math.round(bg + (tg - bg) * t)},${Math.round(bb + (tb - bb) * t)})`;
}

function RunHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const cellMap = new Map(cells.map((c) => [c.date, c]));
  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 89);
  const dow = startDate.getDay();
  startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));

  const weeks: Array<Array<{ date: string; cell: HeatmapCell | null }>> = [];
  const d = new Date(startDate);
  while (d <= today) {
    const week: Array<{ date: string; cell: HeatmapCell | null }> = [];
    for (let i = 0; i < 7 && d <= today; i++) {
      const dateStr = d.toISOString().slice(0, 10);
      week.push({ date: dateStr, cell: cellMap.get(dateStr) ?? null });
      d.setDate(d.getDate() + 1);
    }
    // Pad short last week
    while (week.length < 7) week.push({ date: "", cell: null });
    weeks.push(week);
  }

  const svgWidth = weeks.length * HEATMAP_STEP - HEATMAP_GAP;
  const svgHeight = HEATMAP_LABEL_H + 7 * HEATMAP_STEP - HEATMAP_GAP;

  const monthLabels: Array<{ x: number; label: string }> = [];
  weeks.forEach((week, wi) => {
    const first = week.find((e) => e.date && new Date(e.date + "T00:00:00").getDate() === 1);
    if (first) {
      monthLabels.push({ x: wi * HEATMAP_STEP, label: new Date(first.date + "T00:00:00").toLocaleDateString("en-GB", { month: "short" }) });
    }
  });

  const legendColors = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    t === 0 ? HEATMAP_BASE : interpolateColor(HEATMAP_BASE, HEATMAP_GREEN, 0.2 + 0.8 * t)
  );

  return (
    <div className="space-y-3 overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} className="overflow-visible">
        {monthLabels.map(({ x, label }) => (
          <text key={`${x}-${label}`} x={x} y={HEATMAP_LABEL_H - 4} fontSize={9} fill="#71717a">{label}</text>
        ))}
        {weeks.map((week, wi) =>
          week.map(({ date, cell }, di) => {
            if (!date) return null;
            let fill = HEATMAP_BASE;
            if (cell && cell.count > 0) {
              const t = 0.2 + 0.8 * Math.min(1, cell.count / maxCount);
              fill = interpolateColor(HEATMAP_BASE, cell.success_rate >= 80 ? HEATMAP_GREEN : HEATMAP_RED, t);
            }
            return (
              <rect key={date} x={wi * HEATMAP_STEP} y={HEATMAP_LABEL_H + di * HEATMAP_STEP} width={HEATMAP_CELL} height={HEATMAP_CELL} rx={2} fill={fill}>
                <title>{cell ? `${date}: ${cell.count} runs, ${cell.success_rate}% success` : `${date}: no runs`}</title>
              </rect>
            );
          })
        )}
      </svg>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <span>Less</span>
        {legendColors.map((c, i) => (
          <span key={i} className="inline-block rounded-sm" style={{ width: 10, height: 10, background: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

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
  const [view, setView] = useState<"list" | "graph">("list");
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [timelineRuns, setTimelineRuns] = useState<TimelineRun[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineHours, setTimelineHours] = useState(24);
  const [agentStats, setAgentStats] = useState<Record<string, AgentStats>>({});
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/agents").then((r) => r.json()),
      apiFetch("/api/history?days=7").then((r) => r.json()).catch(() => null),
    ])
      .then(([d, hist]) => {
        const agents: Agent[] = d.agents ?? [];
        setAgents(agents);
        setError(d.error ?? null);
        if (hist) setHistory(hist.snapshots ?? hist ?? []);
        // Fetch stats for all agents in parallel
        Promise.all(
          agents.map((a) =>
            apiFetch(`/api/crons/${a.id}/stats`)
              .then((r) => r.json())
              .then((s) => [a.id, s] as [string, AgentStats])
              .catch(() => null)
          )
        ).then((results) => {
          const map: Record<string, AgentStats> = {};
          for (const r of results) {
            if (r) map[r[0]] = r[1];
          }
          setAgentStats(map);
        });
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
    setHeatmapLoading(true);
    apiFetch("/api/crons/heatmap?days=90")
      .then((r) => r.json())
      .then((d) => setHeatmapCells(d.cells ?? []))
      .catch(() => setHeatmapCells([]))
      .finally(() => setHeatmapLoading(false));
  }, []);

  useEffect(() => {
    loadTimeline(timelineHours);
  }, [timelineHours, loadTimeline]);

  const runAgent = async (id: string) => {
    setRunStates((prev) => ({ ...prev, [id]: "running" }));
    try {
      const res = await apiFetch(`/api/crons/${id}/run`, { method: "POST" });
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
      await apiFetch(`/api/crons/${id}/${action}`, { method: "POST" });
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
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
              <button
                onClick={() => setView("list")}
                className={`px-3 py-1.5 transition-colors ${view === "list" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                List
              </button>
              <button
                onClick={() => setView("graph")}
                className={`px-3 py-1.5 transition-colors ${view === "graph" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Graph
              </button>
            </div>
            <button onClick={load} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        {(() => {
          const statsWithRuns = Object.values(agentStats).filter((s) => s.total_runs > 0);
          if (statsWithRuns.length === 0) return null;
          const fleetRate = Math.round(statsWithRuns.reduce((sum, s) => sum + s.success_rate_7d, 0) / statsWithRuns.length);
          const totalRuns = statsWithRuns.reduce((sum, s) => sum + s.total_runs, 0);
          const color = fleetRate >= 95 ? "text-green-400" : fleetRate >= 80 ? "text-amber-400" : "text-red-400";
          const badgeClass = fleetRate >= 95 ? "bg-green-500/20 text-green-400" : fleetRate >= 80 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400";
          return (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="px-5 py-4 flex items-center gap-6">
                <div>
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Fleet SLA (7d)</p>
                  <p className={`text-2xl font-semibold ${color}`}>{fleetRate}%</p>
                </div>
                <div className="h-8 w-px bg-zinc-800" />
                <div>
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Total runs (7d)</p>
                  <p className="text-lg font-medium text-zinc-200">{totalRuns}</p>
                </div>
                <div className="h-8 w-px bg-zinc-800" />
                <div>
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Agents tracked</p>
                  <p className="text-lg font-medium text-zinc-200">{statsWithRuns.length}</p>
                </div>
                <div className="ml-auto">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${badgeClass}`}>
                    {fleetRate >= 95 ? "Healthy" : fleetRate >= 80 ? "Degraded" : "Unhealthy"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })()}
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
        <ErrorBoundary>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Run Activity (last 90 days)</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {heatmapLoading ? (
                <Skeleton className="h-24 bg-zinc-800 rounded" />
              ) : heatmapCells.length === 0 ? (
                <p className="text-sm text-zinc-500">No run data available</p>
              ) : (
                <RunHeatmap cells={heatmapCells} />
              )}
            </CardContent>
          </Card>
        </ErrorBoundary>
        {view === "graph" && (
          <AgentGraph agents={agents} onSelectAgent={(id) => setSelectedAgentId(id)} />
        )}
        {view === "list" && !loading && agents.length > 0 && (
          <div className="hidden md:grid grid-cols-[1fr_130px_90px_90px_90px_auto] gap-4 px-4 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <span>Name</span><span>Schedule</span><span>Status</span><span>Reliability</span><span>Last Run</span><span>Actions</span>
          </div>
        )}
        {view === "list" && loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 bg-zinc-800 rounded-xl" />)}</div>
        ) : view === "list" && agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
            <Bot className="w-8 h-8 mb-2" />
            <p className="text-sm">No cron jobs found</p>
          </div>
        ) : view === "list" ? (
          <div className="space-y-2">
            {agents.map((agent) => {
              const runState = runStates[agent.id] ?? "idle";
              const runMsg = runMessages[agent.id];
              const isActive = (agent.status || "").toLowerCase() === "active" || (agent.status || "").toLowerCase() === "running";
              const toggling = toggleStates[agent.id] === "loading";
              return (
                <Card key={agent.id} className="bg-zinc-900 border-zinc-800">
                  <CardContent className="px-4 py-3 space-y-2">
                    <div className="flex flex-col gap-2 md:grid md:grid-cols-[1fr_130px_90px_90px_90px_auto] md:gap-4 md:items-center">
                      <span className="text-sm text-zinc-200 font-medium truncate">{agent.name || agent.id}</span>
                      <span className="flex items-center gap-1.5 font-mono text-xs text-violet-400">
                        <Clock className="w-3 h-3 shrink-0" />{agent.schedule || "—"}
                      </span>
                      <Badge className={`text-[10px] border-0 w-fit ${statusBadgeClass(agent.status || "")}`}>{agent.status || "—"}</Badge>
                      {(() => {
                        const s = agentStats[agent.id];
                        if (!s || s.total_runs === 0) return <span className="text-xs text-zinc-600">—</span>;
                        return <Badge className={`text-[10px] border-0 w-fit ${reliabilityBadgeClass(s.success_rate_7d)}`}>{s.success_rate_7d}%</Badge>;
                      })()}
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
        ) : null}
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
