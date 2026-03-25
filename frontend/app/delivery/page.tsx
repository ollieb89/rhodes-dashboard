"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

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
    return <Badge variant="outline" className="border-green-700 text-green-400 text-[10px]">clean</Badge>;
  }
  if (status === "synthetic") {
    return <Badge variant="outline" className="border-amber-700 text-amber-400 text-[10px]">synthetic</Badge>;
  }
  return <Badge variant="outline" className="border-red-700 text-red-400 text-[10px]">blocked</Badge>;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB");
  } catch {
    return iso;
  }
}

export default function DeliveryPage() {
  const [stats, setStats] = useState<FinalizationStats | null>(null);
  const [records, setRecords] = useState<FinalizationRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">Delivery Log</h1>
        <p className="text-sm text-zinc-500 mt-1">Finalization telemetry for all agent workflows</p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-semibold text-zinc-100">{stats?.total_workflows ?? 0}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Total workflows</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-semibold text-green-400">{cleanPct !== null ? `${cleanPct}%` : "—"}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Clean rate</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-semibold text-red-400">{stats?.blocked ?? 0}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Blocked</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-semibold text-zinc-100">{stats ? `${stats.median_visibility_lag_s}s` : "—"}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Median lag</p>
          </CardContent>
        </Card>
      </div>

      {/* Records table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-300">Recent Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-zinc-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-zinc-600">
              <p className="text-sm">No finalization records yet</p>
              <p className="text-xs mt-1">Records will appear here once agents start pushing via POST /api/finalization/record</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 pr-4 text-zinc-500 font-medium">Task ID</th>
                    <th className="text-left py-2 pr-4 text-zinc-500 font-medium">Agent Session</th>
                    <th className="text-left py-2 pr-4 text-zinc-500 font-medium">Branch</th>
                    <th className="text-left py-2 pr-4 text-zinc-500 font-medium">Commit</th>
                    <th className="text-left py-2 pr-4 text-zinc-500 font-medium">Status</th>
                    <th className="text-left py-2 pr-4 text-zinc-500 font-medium">Duration</th>
                    <th className="text-left py-2 text-zinc-500 font-medium">Pushed At</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2 pr-4 text-zinc-300 font-mono truncate max-w-[120px]">{r.task_id || "—"}</td>
                      <td className="py-2 pr-4 text-zinc-400 font-mono truncate max-w-[120px]">{r.agent_session || "—"}</td>
                      <td className="py-2 pr-4 text-zinc-400 truncate max-w-[100px]">{r.branch || "—"}</td>
                      <td className="py-2 pr-4 text-zinc-400 font-mono">{r.commit_hash ? r.commit_hash.slice(0, 7) : "—"}</td>
                      <td className="py-2 pr-4"><StatusBadge status={r.status} /></td>
                      <td className="py-2 pr-4 text-zinc-400">{r.duration_s != null ? `${r.duration_s}s` : "—"}</td>
                      <td className="py-2 text-zinc-500">{formatDate(r.pushed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
