"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLayout } from "@/hooks/use-layout";
import { Package, FileText, Bot, Activity, Clock, RefreshCw, MapPin, Users, Github, Download } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { UpdatedAgo } from "@/components/updated-ago";
import { apiFetch } from "@/lib/api";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const REFRESH_INTERVAL = 30000; // 30 seconds

interface ActivityItem {
  id: string;
  type: "cron" | "article" | "repo";
  title: string;
  text: string;
  timestamp: string;
  level: string;
  url: string | null;
}

interface GitHubProfile {
  login: string;
  name: string;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
  bio: string;
  company: string;
  location: string;
}

interface OverviewStats {
  total_repos: number;
  total_articles: number;
  total_agents: number;
  last_updated: string;
}

interface Repo {
  name: string;
  description: string;
  stargazerCount: number;
  forkCount: number;
  createdAt: string;
  url: string;
}

interface Agent {
  id: string;
  name: string;
  status: string;
  schedule: string;
  last_run: string | null;
  next_run: string | null;
}


interface FinalizationStats {
  total_workflows: number;
  clean_finalizations: number;
  synthetic_finalizations: number;
  blocked: number;
  median_visibility_lag_s: number;
  blocked_rate_pct: number;
  daily: { date: string; clean: number; total: number }[];
}

interface HistorySnapshot {
  timestamp: string;
  total_repos: number;
  total_stars: number;
  total_articles: number;
  total_agents: number;
}

function toSparkData(history: HistorySnapshot[], key: keyof HistorySnapshot) {
  return history.map((h) => ({ value: h[key] as number }));
}

function computeWeekDelta(
  history: HistorySnapshot[],
  key: keyof HistorySnapshot,
  currentValue: number
): React.ReactNode | null {
  if (history.length < 2) return null;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let closest: HistorySnapshot | null = null;
  let minDiff = Infinity;
  for (const snap of history) {
    const diff = Math.abs(new Date(snap.timestamp).getTime() - sevenDaysAgo);
    if (diff < minDiff) { minDiff = diff; closest = snap; }
  }
  if (!closest) return null;
  const oldValue = closest[key] as number;
  const delta = currentValue - oldValue;
  if (delta === 0) return null;
  const pct = oldValue !== 0 ? (delta / oldValue) * 100 : null;
  const sign = delta > 0 ? "+" : "";
  const pctStr = pct !== null ? ` (${sign}${pct.toFixed(1)}%)` : "";
  const arrow = delta > 0 ? "⬆" : "⬇";
  const color = delta > 0 ? "text-green-400" : "text-red-400";
  return (
    <span className={`text-xs ${color}`}>
      {arrow} {sign}{delta} this week{pctStr}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function OverviewPage() {
  const { order, moveCard } = useLayout();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [profile, setProfile] = useState<GitHubProfile | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [finalizationStats, setFinalizationStats] = useState<FinalizationStats | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [ovRes, prodRes, agentsRes, histRes, profRes, actRes, finRes] = await Promise.all([
        apiFetch("/api/overview"),
        apiFetch("/api/products"),
        apiFetch("/api/agents"),
        apiFetch("/api/history?days=14").catch(() => null),
        apiFetch("/api/github/profile").catch(() => null),
        apiFetch("/api/activity?limit=20").catch(() => null),
        apiFetch("/api/finalization/stats").catch(() => null),
      ]);
      const ov = await ovRes.json();
      if (profRes) { const profData = await profRes.json(); setProfile(profData); }
      if (actRes) { const actData = await actRes.json(); setActivity(actData.items ?? []); }
      if (finRes && finRes.ok) { const finData = await finRes.json(); setFinalizationStats(finData); }
      const prod = await prodRes.json();
      const ag = await agentsRes.json();
      setStats(ov.stats);
      setFetchedAt(new Date());
      setRepos(
        (prod.repos ?? [])
          .sort(
            (a: Repo, b: Repo) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 5)
      );
      setAgents(ag.agents ?? []);
      if (histRes && histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.snapshots ?? histData ?? []);
      }
      setError(null);
    } catch {
      setError("Failed to connect to backend at :8521");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  const reposSpark = toSparkData(history, "total_repos");
  const articlesSpark = toSparkData(history, "total_articles");
  const agentsSpark = toSparkData(history, "total_agents");

  const exportSnapshot = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleString("en-GB");
    const activeAgents = agents.filter((a) => a.status === "active" || a.status === "running").length;
    const topRepo = [...repos].sort((a, b) => b.stargazerCount - a.stargazerCount)[0];
    const lines: string[] = [
      "# Rhodes Command Center Snapshot",
      `**Generated:** ${timeStr}`,
      `**By:** ${profile?.login ?? "ollieb89"}`,
      "",
      "## Overview",
      "| Metric | Value |",
      "|--------|-------|",
      `| Repositories | ${stats?.total_repos ?? repos.length} |`,
      `| Active agents | ${activeAgents} / ${agents.length} |`,
      "",
    ];
    if (topRepo) {
      lines.push("## Top Repository");
      lines.push(`**[${topRepo.name}](${topRepo.url})** - ${topRepo.stargazerCount} stars, ${topRepo.forkCount} forks`);
      if (topRepo.description) lines.push(`> ${topRepo.description}`);
      lines.push("");
    }
    if (activity.length > 0) {
      lines.push("## Recent Activity");
      activity.slice(0, 5).forEach((item) => {
        const ts = item.timestamp ? new Date(item.timestamp).toLocaleString("en-GB") : "";
        const link = item.url ? `[${item.title}](${item.url})` : item.title;
        lines.push(`- **${item.type.toUpperCase()}** ${link}${ts ? ` (${ts})` : ""}`);
        if (item.text) lines.push(`  ${item.text.slice(0, 100)}`);
      });
      lines.push("");
    }
    lines.push("---");
    lines.push(`*Exported from Rhodes Command Center at ${timeStr}*`);
    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-snapshot-${dateStr}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = order.indexOf(active.id as string);
      const newIndex = order.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) moveCard(oldIndex, newIndex);
    }
  }

  if (error && loading) {
  return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">Overview</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <UpdatedAgo fetchedAt={fetchedAt} />
            {refreshing && <RefreshCw className="w-3 h-3 animate-spin inline-block ml-1" />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <Badge variant="outline" className="border-red-900 text-red-400 text-[10px]">
              Offline
            </Badge>
          )}
          <button
            onClick={exportSnapshot}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={() => load(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {order.map((cardId) => {
              if (cardId === "profile") {
                if (!profile || !profile.login) return null;
                return (
                  <SortableCard key="profile" id="profile">
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardContent className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={profile.avatar_url}
                            alt={profile.login}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full border border-zinc-700 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-zinc-100">{profile.name || profile.login}</span>
                              <a
                                href={`https://github.com/${profile.login}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-violet-400 transition-colors"
                              >
                                <Github className="w-3 h-3" />
                                {profile.login}
                              </a>
                            </div>
                            {profile.bio && (
                              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{profile.bio}</p>
                            )}
                            {profile.location && (
                              <p className="flex items-center gap-1 text-[11px] text-zinc-500 mt-0.5">
                                <MapPin className="w-3 h-3" />{profile.location}
                              </p>
                            )}
                          </div>
                          <div className="hidden sm:flex items-center gap-4 text-xs text-zinc-400 shrink-0">
                            <div className="text-center">
                              <p className="font-semibold text-zinc-200">{profile.public_repos}</p>
                              <p className="text-[10px] text-zinc-600">repos</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-zinc-200">{profile.followers}</p>
                              <p className="text-[10px] text-zinc-600">followers</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-zinc-200">{profile.following}</p>
                              <p className="text-[10px] text-zinc-600">following</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </SortableCard>
                );
              }

              if (cardId === "stats") {
                return (
                  <SortableCard key="stats" id="stats">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-24 rounded-xl bg-zinc-800" />
                        ))
                      ) : (
                        <>
                          <StatCard
                            label="Repositories"
                            value={stats?.total_repos ?? 0}
                            icon={Package}
                            accent="text-blue-400"
                            sparkData={reposSpark}
                            sparkColor="#60a5fa"
                            delta={computeWeekDelta(history, "total_repos", stats?.total_repos ?? 0)}
                          />
                          <StatCard
                            label="Articles"
                            value={stats?.total_articles ?? 0}
                            icon={FileText}
                            accent="text-green-400"
                            sparkData={articlesSpark}
                            sparkColor="#4ade80"
                            delta={computeWeekDelta(history, "total_articles", stats?.total_articles ?? 0)}
                          />
                          <StatCard
                            label="Cron Agents"
                            value={stats?.total_agents ?? 0}
                            icon={Bot}
                            accent="text-violet-400"
                            sparkData={agentsSpark}
                            sparkColor="#a78bfa"
                            delta={computeWeekDelta(history, "total_agents", stats?.total_agents ?? 0)}
                          />
                          <StatCard
                            label="Active"
                            value={agents.filter((a: Agent) => a.status === "active" || a.status === "running").length}
                            icon={Activity}
                            accent="text-orange-400"
                            sub="agents running"
                          />
                        </>
                      )}
                    </div>
                  </SortableCard>
                );
              }

              if (cardId === "recent-repos") {
                return (
                  <SortableCard key="recent-repos" id="recent-repos">
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-zinc-300">Recent Repositories</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {loading
                          ? Array.from({ length: 5 }).map((_, i) => (
                              <Skeleton key={i} className="h-10 bg-zinc-800 rounded-lg" />
                            ))
                          : repos.map((repo) => (
                              <a
                                key={repo.name}
                                href={repo.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-zinc-200 group-hover:text-violet-300 truncate">{repo.name}</p>
                                  <p className="text-xs text-zinc-500 truncate">{repo.description || "—"}</p>
                                </div>
                                <div className="flex items-center gap-2 ml-3 shrink-0">
                                  {repo.stargazerCount > 0 && (
                                    <span className="text-xs text-zinc-500">★ {repo.stargazerCount}</span>
                                  )}
                                  <span className="text-xs text-zinc-600">{timeAgo(repo.createdAt)}</span>
                                </div>
                              </a>
                            ))}
                      </CardContent>
                    </Card>
                  </SortableCard>
                );
              }

              if (cardId === "cron-health") {
                return (
                  <SortableCard key="cron-health" id="cron-health">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Agent Fleet */}
                      <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-zinc-300">Agent Fleet</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                              <Skeleton key={i} className="h-10 bg-zinc-800 rounded-lg mb-2" />
                            ))
                          ) : agents.length === 0 ? (
                            <p className="text-sm text-zinc-500 py-4 text-center">No agents found — is openclaw installed?</p>
                          ) : (
                            <div className="space-y-2">
                              {agents.slice(0, 6).map((agent, i) => {
                                const name = agent.name || agent.id || `Agent ${i + 1}`;
                                const status = agent.status || "unknown";
                                const schedule = agent.schedule || "";
                                const lastRun = agent.last_run || null;
                                return (
                                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-zinc-200 truncate">{name}</p>
                                      <div className="flex items-center gap-3">
                                        {schedule && (
                                          <p className="text-xs text-zinc-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />{schedule}
                                          </p>
                                        )}
                                        {lastRun && <p className="text-xs text-zinc-600">ran {timeAgo(lastRun)}</p>}
                                      </div>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] shrink-0 ml-2 ${
                                        status.toLowerCase() === "active" || status.toLowerCase() === "running"
                                          ? "border-green-700 text-green-400"
                                          : "border-zinc-700 text-zinc-400"
                                      }`}
                                    >
                                      {status}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      {/* Cron Health */}
                      <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-zinc-300">Cron Health</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                              <Skeleton key={i} className="h-10 bg-zinc-800 rounded-lg mb-2" />
                            ))
                          ) : agents.length === 0 ? (
                            <p className="text-sm text-zinc-500 py-4 text-center">No agents found — is openclaw installed?</p>
                          ) : (
                            <div className="space-y-2">
                              {agents.slice(0, 6).map((agent, i) => {
                                const name = agent.name || agent.id || `Agent ${i + 1}`;
                                const status = (agent.status || "unknown").toLowerCase();
                                const schedule = agent.schedule || "";
                                const badgeClass =
                                  status === "active" || status === "running"
                                    ? "bg-green-500/20 text-green-400"
                                    : status === "paused"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-zinc-700/50 text-zinc-400";
                                return (
                                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-zinc-200 truncate">{name}</p>
                                      {schedule && (
                                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                                          <Clock className="w-3 h-3" />{schedule}
                                        </p>
                                      )}
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-xs shrink-0 ml-2 ${badgeClass}`}>{status}</span>
                                  </div>
                                );
                              })}
                              <div className="flex items-center justify-between pt-1">
                                <p className="text-xs text-zinc-500">
                                  {agents.filter((a) => a.status === "active" || a.status === "running").length} of {agents.length} agents active
                                </p>
                                {agents.length > 6 && (
                                  <Link href="/agents" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                                    View all →
                                  </Link>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </SortableCard>
                );
              }

              if (cardId === "delivery-health") {
                const fs = finalizationStats;
                const cleanPct = fs && fs.total_workflows > 0 ? Math.round((fs.clean_finalizations / fs.total_workflows) * 100) : null;
                const sparkData = (fs?.daily ?? []).map((d) => ({
                  value: d.total > 0 ? Math.round((d.clean / d.total) * 100) : 0,
                }));
                return (
                  <SortableCard key="delivery-health" id="delivery-health">
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-zinc-300">Delivery Health</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                          <div className="text-center">
                            <p className="text-lg font-semibold text-zinc-100">{fs?.total_workflows ?? 0}</p>
                            <p className="text-[10px] text-zinc-500">Total</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-green-400">{cleanPct !== null ? `${cleanPct}%` : "—"}</p>
                            <p className="text-[10px] text-zinc-500">Clean</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-red-400">{fs?.blocked ?? 0}</p>
                            <p className="text-[10px] text-zinc-500">Blocked</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-zinc-100">{fs ? `${fs.median_visibility_lag_s}s` : "—"}</p>
                            <p className="text-[10px] text-zinc-500">Median lag</p>
                          </div>
                        </div>
                        {sparkData.length > 0 && (
                          <div className="h-12">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparkData}>
                                <Line type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        <div>
                          <Link href="/delivery" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                            View full log →
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </SortableCard>
                );
              }

              if (cardId === "activity") {
                return (
                  <SortableCard key="activity" id="activity">
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <CardTitle className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-zinc-400" />
                          Recent Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-4">
                        {loading ? (
                          <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} className="h-10 bg-zinc-800 rounded-lg animate-pulse" />
                            ))}
                          </div>
                        ) : activity.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-24 text-zinc-600">
                            <Activity className="w-6 h-6 mb-1 opacity-30" />
                            <p className="text-xs">No recent activity</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {activity.slice(0, 15).map((item) => {
                              const Icon = item.type === "article" ? FileText : item.type === "repo" ? Package : Bot;
                              const iconColor = item.type === "article" ? "text-blue-400" : item.type === "repo" ? "text-violet-400" : item.level === "error" ? "text-red-400" : "text-green-400";
                              const diff = Math.floor((Date.now() - new Date(item.timestamp).getTime()) / 60000);
                              const ago = diff < 1 ? "just now" : diff < 60 ? `${diff}m ago` : diff < 1440 ? `${Math.floor(diff / 60)}h ago` : `${Math.floor(diff / 1440)}d ago`;
                              const inner = (
                                <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-800/40 transition-colors">
                                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${iconColor}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-zinc-300 font-medium truncate">{item.title}</p>
                                    {item.text && <p className="text-[10px] text-zinc-500 truncate mt-0.5">{item.text.slice(0, 80)}</p>}
                                  </div>
                                  <span className="text-[10px] text-zinc-600 shrink-0 mt-0.5">{ago}</span>
                                </div>
                              );
                              return item.url ? (
                                <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block">{inner}</a>
                              ) : (
                                <div key={item.id}>{inner}</div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </SortableCard>
                );
              }

              return null;
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
    </ErrorBoundary>
  );
}
