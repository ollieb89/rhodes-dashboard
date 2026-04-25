"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Activity, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ErrorBoundary } from "@/components/error-boundary";
import { UpdatedAgo } from "@/components/updated-ago";

interface FinalizationStats {
  total_workflows: number;
  clean_finalizations: number;
  synthetic_finalizations: number;
  blocked: number;
  median_visibility_lag_s: number;
  blocked_rate_pct: number;
}

interface FinalizationRecord {
  id: string;
  task_id: string;
  agent_session: string;
  commit_hash: string;
  branch: string;
  pushed_at: string;
  diff_clean: boolean;
  duration_s: number;
  status: "clean" | "synthetic" | "blocked";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "clean") {
    return (
      <Badge variant="outline" className="border-green-700/50 text-green-400 bg-green-500/5 text-[10px] gap-1 px-1.5">
        <CheckCircle2 className="w-2.5 h-2.5" /> clean
      </Badge>
    );
  }
  if (status === "synthetic") {
    return (
      <Badge variant="outline" className="border-amber-700/50 text-amber-400 bg-amber-500/5 text-[10px] gap-1 px-1.5">
        <AlertCircle className="w-2.5 h-2.5" /> synthetic
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-red-700/50 text-red-400 bg-red-500/5 text-[10px] gap-1 px-1.5">
      <XCircle className="w-2.5 h-2.5" /> blocked
    </Badge>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function DeliveryPage() {
  const [stats, setStats] = useState<FinalizationStats | null>(null);
  const [records, setRecords] = useState<FinalizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, logRes] = await Promise.all([
          apiFetch("/api/finalization/stats").catch(() => null),
          apiFetch("/api/finalization/log?limit=50").catch(() => null),
        ]);
        if (statsRes && statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
        if (logRes && logRes.ok) {
          const data = await logRes.json();
          setRecords(data.records ?? []);
        }
        setFetchedAt(new Date());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cleanPct =
    stats && stats.total_workflows > 0
      ? Math.round((stats.clean_finalizations / stats.total_workflows) * 100)
      : null;

  return (
    <ErrorBoundary>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-violet-400" />
              <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">Delivery Log</h1>
            </div>
            <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
              <UpdatedAgo fetchedAt={fetchedAt} />
            </p>
          </div>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800 shadow-sm shadow-black/20">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-2xl font-semibold text-zinc-100">{stats?.total_workflows ?? 0}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Total workflows</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800 shadow-sm shadow-black/20">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-2xl font-semibold text-green-400">{cleanPct !== null ? `${cleanPct}%` : "—"}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Clean rate</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800 shadow-sm shadow-black/20">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-2xl font-semibold text-red-400">{stats?.blocked ?? 0}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Blocked</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800 shadow-sm shadow-black/20">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-2xl font-semibold text-zinc-100">{stats ? `${stats.median_visibility_lag_s}s` : "—"}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Median lag</p>
            </CardContent>
          </Card>
        </div>

        {/* Records table */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-sm shadow-black/20 overflow-hidden">
          <CardHeader className="pb-3 border-b border-zinc-800/50">
            <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-500" />
              Recent Records
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-zinc-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
                <Truck className="w-8 h-8 mb-2 opacity-10" />
                <p className="text-sm">No finalization records yet</p>
                <p className="text-xs mt-1">Telemetry will appear here once agents finish tasks</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-800/20 text-zinc-500 font-medium uppercase tracking-wider">
                      <th className="px-4 py-3">Task ID</th>
                      <th className="px-4 py-3">Session</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3">Commit</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" /> Lag
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right">Pushed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 text-zinc-200 font-mono truncate max-w-[140px]">{r.task_id || "—"}</td>
                        <td className="px-4 py-3 text-zinc-500 font-mono truncate max-w-[120px]">{r.agent_session || "—"}</td>
                        <td className="px-4 py-3 text-zinc-400 truncate max-w-[100px]">{r.branch || "—"}</td>
                        <td className="px-4 py-3 text-zinc-500 font-mono">{r.commit_hash ? r.commit_hash.slice(0, 7) : "—"}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-right text-zinc-400 font-mono">{r.duration_s != null ? `${r.duration_s}s` : "—"}</td>
                        <td className="px-4 py-3 text-right text-zinc-500">{formatDate(r.pushed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
