"use client";

import { Fragment, useEffect, useState } from "react";
import { Bot, Clock, RefreshCw, Play, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const API = "http://localhost:8521";

interface Agent {
  id: string;
  name: string;
  schedule: string;
  status: string;
  last_run: string | null;
  next_run: string | null;
}

type RunState = "idle" | "running" | "success" | "error";

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("run") || s.includes("enabled"))
    return "border-green-700 text-green-400";
  if (s.includes("pause") || s.includes("suspend"))
    return "border-yellow-700 text-yellow-500";
  if (s.includes("fail") || s.includes("error"))
    return "border-red-700 text-red-400";
  return "border-zinc-700 text-zinc-400";
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

function timeUntil(iso: string | null): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "overdue";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "soon";
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.floor(hrs / 24)}d`;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const [runMessages, setRunMessages] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    fetch(`${API}/api/agents`)
      .then((r) => r.json())
      .then((d) => {
        setAgents(d.agents ?? []);
        if (d.error) setError(d.error);
        else setError(null);
      })
      .catch(() => setError("Backend unavailable"))
      .finally(() => {
        setLoading(false);
        setLastRefresh(Date.now());
      });
  };

  useEffect(() => {
    load();
  }, []);

  const runAgent = async (id: string) => {
    setRunStates((prev) => ({ ...prev, [id]: "running" }));
    try {
      const res = await fetch(`${API}/api/crons/${id}/run`, { method: "POST" });
      if (res.ok) {
        setRunStates((prev) => ({ ...prev, [id]: "success" }));
        setRunMessages((prev) => ({ ...prev, [id]: "Started" }));
      } else {
        const data = await res.json().catch(() => ({}));
        setRunStates((prev) => ({ ...prev, [id]: "error" }));
        setRunMessages((prev) => ({
          ...prev,
          [id]: data.error ?? `Error ${res.status}`,
        }));
      }
    } catch {
      setRunStates((prev) => ({ ...prev, [id]: "error" }));
      setRunMessages((prev) => ({ ...prev, [id]: "Network error" }));
    }
    setTimeout(() => {
      setRunStates((prev) => ({ ...prev, [id]: "idle" }));
      setRunMessages((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }, 3000);
  };

  return (
    <div className="space-y-5 max-w-5xl">
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

      {error && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 bg-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
          <Bot className="w-8 h-8 mb-2" />
          <p className="text-sm">No cron jobs found</p>
          <p className="text-xs mt-1 text-zinc-600">
            Run <code className="font-mono">openclaw cron list</code> manually
            to debug
          </p>
        </div>
      ) : (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Schedule
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Last Run
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Next Run
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => {
                    const runState = runStates[agent.id] ?? "idle";
                    const isExpanded = expandedId === agent.id;
                    return (
                      <Fragment key={agent.id}>
                        <tr
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : agent.id)
                          }
                        >
                          <td className="px-4 py-3 text-zinc-200 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                              )}
                              {agent.name || agent.id}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="flex items-center gap-1.5 font-mono text-xs text-violet-400">
                              <Clock className="w-3 h-3" />
                              {agent.schedule || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${statusColor(
                                agent.status || ""
                              )}`}
                            >
                              {agent.status || "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                            {timeAgo(agent.last_run)}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                            {timeUntil(agent.next_run)}
                          </td>
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-2">
                              {runMessages[agent.id] && (
                                <span
                                  className={`text-xs ${
                                    runState === "success"
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {runMessages[agent.id]}
                                </span>
                              )}
                              <button
                                onClick={() => runAgent(agent.id)}
                                disabled={runState === "running"}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:border-violet-700 hover:text-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Play
                                  className={`w-3 h-3 ${
                                    runState === "running"
                                      ? "animate-pulse"
                                      : ""
                                  }`}
                                />
                                {runState === "running" ? "Running…" : "Run"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-zinc-800/50 bg-zinc-800/20">
                            <td colSpan={6} className="px-6 py-3">
                              <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap break-all">
                                {JSON.stringify(agent, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-zinc-600">
        Last refreshed: {new Date(lastRefresh).toLocaleTimeString()}
      </p>
    </div>
  );
}
