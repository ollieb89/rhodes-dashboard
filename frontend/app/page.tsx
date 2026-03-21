"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Package, FileText, Bot, Activity, Clock, RefreshCw, MapPin, Users, Github } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { UpdatedAgo } from "@/components/updated-ago";

const API = "http://localhost:8521";
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OverviewPage() {
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

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [ovRes, prodRes, agentsRes, histRes, profRes, actRes] = await Promise.all([
        fetch(`${API}/api/overview`),
        fetch(`${API}/api/products`),
        fetch(`${API}/api/agents`),
        fetch(`${API}/api/history?days=7`).catch(() => null),
        fetch(`${API}/api/github/profile`).catch(() => null),
        fetch(`${API}/api/activity?limit=20`).catch(() => null),
      ]);
      const ov = await ovRes.json();
      if (profRes) { const profData = await profRes.json(); setProfile(profData); }
      if (actRes) { const actData = await actRes.json(); setActivity(actData.items ?? []); }
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
          <h1 className="text-xl font-semibold text-zinc-100">Overview</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <UpdatedAgo fetchedAt={fetchedAt} />
            {refreshing && <RefreshCw className="w-3 h-3 animate-spin inline-block ml-1" />}
          </p>
        </div>
        {error && (
          <Badge variant="outline" className="border-red-900 text-red-400 text-[10px]">
            Offline
          </Badge>
        )}
      </div>

      {/* GitHub Profile Card */}
      {profile && profile.login && (
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
              <div className="flex items-center gap-4 text-xs text-zinc-400 shrink-0">
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
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            />
            <StatCard
              label="Articles"
              value={stats?.total_articles ?? 0}
              icon={FileText}
              accent="text-green-400"
              sparkData={articlesSpark}
              sparkColor="#4ade80"
            />
            <StatCard
              label="Cron Agents"
              value={stats?.total_agents ?? 0}
              icon={Bot}
              accent="text-violet-400"
              sparkData={agentsSpark}
              sparkColor="#a78bfa"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Repos */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Recent Repositories
            </CardTitle>
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
                      <p className="text-sm font-medium text-zinc-200 group-hover:text-violet-300 truncate">
                        {repo.name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {repo.description || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {repo.stargazerCount > 0 && (
                        <span className="text-xs text-zinc-500">
                          ★ {repo.stargazerCount}
                        </span>
                      )}
                      <span className="text-xs text-zinc-600">
                        {timeAgo(repo.createdAt)}
                      </span>
                    </div>
                  </a>
                ))}
          </CardContent>
        </Card>

        {/* Agent Fleet */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Agent Fleet
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-10 bg-zinc-800 rounded-lg mb-2"
                />
              ))
            ) : agents.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">
                No agents found — is openclaw installed?
              </p>
            ) : (
              <div className="space-y-2">
                {agents.slice(0, 6).map((agent, i) => {
                  const name = agent.name || agent.id || `Agent ${i + 1}`;
                  const status = agent.status || "unknown";
                  const schedule = agent.schedule || "";
                  const lastRun = agent.last_run || null;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {name}
                        </p>
                        <div className="flex items-center gap-3">
                          {schedule && (
                            <p className="text-xs text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {schedule}
                            </p>
                          )}
                          {lastRun && (
                            <p className="text-xs text-zinc-600">
                              ran {timeAgo(lastRun)}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ml-2 ${
                          status.toLowerCase() === "active" ||
                          status.toLowerCase() === "running"
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
            <CardTitle className="text-sm font-medium text-zinc-300">
              Cron Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 bg-zinc-800 rounded-lg mb-2" />
              ))
            ) : agents.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">
                No agents found — is openclaw installed?
              </p>
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
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {name}
                        </p>
                        {schedule && (
                          <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {schedule}
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs shrink-0 ml-2 ${badgeClass}`}
                      >
                        {status}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-zinc-500">
                    {agents.filter((a) => a.status === "active" || a.status === "running").length} of {agents.length} agents active
                  </p>
                  {agents.length > 6 && (
                    <Link
                      href="/agents"
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      View all →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
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
    </div>
    </ErrorBoundary>
  );
}
