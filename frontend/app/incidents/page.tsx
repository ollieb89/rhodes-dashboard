"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, AlertCircle, Info, RefreshCw, CheckCircle, ExternalLink, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { UpdatedAgo } from "@/components/updated-ago";

const API = "http://localhost:8521";

interface Incident {
  id: string;
  source: string;
  severity: "critical" | "warning" | "info";
  title: string;
  text: string;
  timestamp: string | null;
  url: string | null;
}

interface Counts { critical: number; warning: number; info: number; total: number; }

function severityBadge(sev: Incident["severity"]) {
  if (sev === "critical") return "bg-red-500/20 text-red-400 border-red-800/40";
  if (sev === "warning") return "bg-amber-500/20 text-amber-400 border-amber-800/40";
  return "bg-blue-500/20 text-blue-400 border-blue-800/40";
}

function SeverityIcon({ sev }: { sev: Incident["severity"] }) {
  if (sev === "critical") return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
  if (sev === "warning") return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
}

function fmtTs(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  } catch { return ""; }
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API}/api/incidents`);
      const data = await res.json();
      setIncidents(data.incidents ?? []);
      setCounts(data.counts ?? null);
      setFetchedAt(new Date());
      setError(null);
    } catch {
      setError("Backend unavailable");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <ErrorBoundary>
      <div className="space-y-5 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Incidents</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-zinc-500">Active failures and warnings</p>
              <UpdatedAgo fetchedAt={fetchedAt} />
            </div>
          </div>
          <button
            onClick={() => load(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Summary counts */}
        {counts && (
          <div className="flex items-center gap-3 flex-wrap">
            {counts.critical > 0 && (
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-800/40 text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />{counts.critical} critical
              </span>
            )}
            {counts.warning > 0 && (
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />{counts.warning} warning
              </span>
            )}
            {counts.total === 0 && (
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-950/30 border border-green-800/40 text-green-400">
                <CheckCircle className="w-3.5 h-3.5" />All clear
              </span>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Incident list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 bg-zinc-800 rounded-xl" />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col items-center justify-center h-48 text-zinc-500">
              <ShieldAlert className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No incidents detected</p>
              <p className="text-xs mt-1 text-zinc-600">All systems appear healthy</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => {
              const card = (
                <Card key={inc.id} className={`border-zinc-800 transition-colors ${inc.severity === "critical" ? "bg-red-950/10 border-red-900/30" : inc.severity === "warning" ? "bg-amber-950/10 border-amber-900/30" : "bg-zinc-900"}`}>
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <SeverityIcon sev={inc.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-medium text-zinc-200">{inc.title}</span>
                          <Badge className={`text-[9px] border px-1.5 py-0 ${severityBadge(inc.severity)}`}>{inc.severity}</Badge>
                          <Badge className="text-[9px] bg-zinc-800/60 text-zinc-500 border-zinc-700/40 border px-1.5 py-0">{inc.source}</Badge>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">{inc.text}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {inc.timestamp && <span className="text-[10px] text-zinc-600">{fmtTs(inc.timestamp)}</span>}
                        {inc.url && <ExternalLink className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              return inc.url ? (
                <a key={inc.id} href={inc.url} target="_blank" rel="noreferrer" className="block">{card}</a>
              ) : card;
            })}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
