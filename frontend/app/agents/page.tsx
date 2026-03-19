"use client";

import { useEffect, useState } from "react";
import { Bot, Clock, RefreshCw, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const API = "http://localhost:8521";

interface Agent {
  [key: string]: string;
}

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const load = () => {
    setLoading(true);
    fetch(`${API}/api/agents`)
      .then((r) => r.json())
      .then((d) => {
        setAgents(d.agents ?? []);
        setRaw(d.raw ?? "");
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

  const headers = agents.length > 0 ? Object.keys(agents[0]) : [];

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Agents</h1>
          <p className="text-sm text-zinc-500 mt-1">
            OpenClaw cron jobs ({agents.length} found)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            {showRaw ? "Hide" : "Raw"}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          {raw && (
            <p className="text-xs text-red-500/70 mt-1">
              openclaw may not be installed or returned no parseable output
            </p>
          )}
        </div>
      )}

      {showRaw && raw && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">
            Raw output
          </p>
          <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all">
            {raw}
          </pre>
        </div>
      )}

      {/* Table */}
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
      ) : headers.length > 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent, i) => {
                    const status =
                      agent.status || agent.Status || agent.state || "";
                    return (
                      <tr
                        key={i}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                      >
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="px-4 py-3 text-zinc-300 whitespace-nowrap"
                          >
                            {h.toLowerCase().includes("status") ||
                            h.toLowerCase().includes("state") ? (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${statusColor(
                                  agent[h] || ""
                                )}`}
                              >
                                {agent[h] || "—"}
                              </Badge>
                            ) : h.toLowerCase().includes("schedule") ||
                              h.toLowerCase().includes("cron") ? (
                              <span className="flex items-center gap-1.5 font-mono text-xs text-violet-400">
                                <Clock className="w-3 h-3" />
                                {agent[h] || "—"}
                              </span>
                            ) : (
                              <span className="text-sm">{agent[h] || "—"}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-zinc-600">
        Last refreshed: {new Date(lastRefresh).toLocaleTimeString()}
      </p>
    </div>
  );
}
