"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import {
  Star,
  GitFork,
  BookOpen,
  Heart,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { UpdatedAgo } from "@/components/updated-ago";

const API = "http://localhost:8521";
const REFRESH_INTERVAL = 60000;

interface MetricsData {
  total_stars: number;
  total_forks: number;
  total_repos: number;
  total_articles: number;
  total_article_views: number;
  total_article_reactions: number;
  top_repo: { name: string; stars: number; url: string } | null;
  top_article: { title: string; views: number; url: string } | null;
}

interface Repo {
  name: string;
  stargazerCount: number;
  forkCount: number;
  url: string;
}

interface Article {
  id: number;
  title: string;
  page_views_count: number;
  public_reactions_count: number;
  url: string;
  published: boolean;
}

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "8px",
  color: "#e4e4e7",
  fontSize: "12px",
};

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [metricsRes, prodRes, artRes] = await Promise.all([
        fetch(`${API}/api/metrics`),
        fetch(`${API}/api/products`),
        fetch(`${API}/api/articles`),
      ]);
      const metricsData = await metricsRes.json();
      const prodData = await prodRes.json();
      const artData = await artRes.json();
      setMetrics(metricsData);
      setRepos(prodData.repos ?? []);
      setArticles((artData.articles ?? []).filter((a: Article) => a.published));
      setError(null);
      setLastUpdated(new Date());
    } catch {
      setError("Failed to connect to backend at :8521");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  const topReposChart = [...repos]
    .sort((a, b) => b.stargazerCount - a.stargazerCount)
    .slice(0, 8)
    .map((r) => ({
      name: r.name.length > 14 ? r.name.slice(0, 14) + "…" : r.name,
      stars: r.stargazerCount,
      forks: r.forkCount,
    }));

  const topReposList = [...repos]
    .sort((a, b) => b.stargazerCount - a.stargazerCount)
    .slice(0, 10);

  const topArticlesList = [...articles]
    .sort((a, b) => b.page_views_count - a.page_views_count)
    .slice(0, 10);

  const formatTime = (d: Date) =>
    d.toTimeString().slice(0, 8);

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Metrics</h1>
            <p className="text-sm text-zinc-500 mt-1">Loading…</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-zinc-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-6xl">
        <h1 className="text-xl font-semibold text-zinc-100">Metrics</h1>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Metrics</h1>
          <p className="text-sm text-zinc-500 mt-1">Aggregated stats for repos &amp; content</p>
          <UpdatedAgo fetchedAt={lastUpdated} className="mt-0.5" />
        </div>
        {lastUpdated && (
          <p className="text-xs text-zinc-600">
            Updated {formatTime(lastUpdated)} · auto-refresh 60s
          </p>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Stars"
          value={metrics?.total_stars ?? 0}
          icon={Star}
          accent="text-yellow-400"
        />
        <StatCard
          label="Total Forks"
          value={metrics?.total_forks ?? 0}
          icon={GitFork}
          accent="text-blue-400"
        />
        <StatCard
          label="Article Views"
          value={metrics?.total_article_views ?? 0}
          icon={BookOpen}
          accent="text-violet-400"
        />
        <StatCard
          label="Article Reactions"
          value={metrics?.total_article_reactions ?? 0}
          icon={Heart}
          accent="text-pink-400"
        />
      </div>

      {/* Stars vs Forks chart + Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Stars vs Forks — Top 8 Repos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topReposChart.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topReposChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "#71717a" }} />
                  <Bar dataKey="stars" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="forks" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2">
                Top Repo
              </p>
              {metrics?.top_repo ? (
                <a
                  href={metrics.top_repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-3 py-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200 group-hover:text-violet-300">
                      {metrics.top_repo.name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      ★ {metrics.top_repo.stars} stars
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-violet-400" />
                </a>
              ) : (
                <p className="text-xs text-zinc-600 px-3">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2">
                Top Article
              </p>
              {metrics?.top_article ? (
                <a
                  href={metrics.top_article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-3 py-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200 group-hover:text-violet-300 truncate">
                      {metrics.top_article.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {metrics.top_article.views.toLocaleString()} views
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-violet-400 shrink-0 ml-2" />
                </a>
              ) : (
                <p className="text-xs text-zinc-600 px-3">—</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranked lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Repos ranked list */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Top Repos by Stars
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topReposList.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">No repos</p>
            ) : (
              <div className="space-y-1">
                {topReposList.map((repo, i) => (
                  <div
                    key={repo.name}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="text-xs text-zinc-600 w-5 shrink-0 text-right">
                      #{i + 1}
                    </span>
                    <p className="text-sm text-zinc-200 flex-1 truncate min-w-0">
                      {repo.name}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-yellow-500 flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {repo.stargazerCount}
                      </span>
                      <span className="text-xs text-blue-400 flex items-center gap-1">
                        <GitFork className="w-3 h-3" />
                        {repo.forkCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Articles ranked list */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Top Articles by Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topArticlesList.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">
                No articles — check DEVTO_API_KEY
              </p>
            ) : (
              <div className="space-y-1">
                {topArticlesList.map((article, i) => (
                  <div
                    key={article.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="text-xs text-zinc-600 w-5 shrink-0 text-right">
                      #{i + 1}
                    </span>
                    <p className="text-sm text-zinc-200 flex-1 truncate min-w-0">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {(article.page_views_count ?? 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-pink-400 flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {article.public_reactions_count ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </ErrorBoundary>
  );
}
