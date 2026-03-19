"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const API = "http://localhost:8521";

interface Repo {
  name: string;
  description: string;
  stargazerCount: number;
  forkCount: number;
  createdAt: string;
}

interface Article {
  id: number;
  title: string;
  positive_reactions_count: number;
  comments_count: number;
  page_views_count: number;
  published_at: string;
  reading_time_minutes: number;
  published: boolean;
}

const COLORS = ["#7c3aed", "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"];

export default function MetricsPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/products`).then((r) => r.json()),
      fetch(`${API}/api/articles`).then((r) => r.json()),
    ])
      .then(([prod, art]) => {
        setRepos(prod.repos ?? []);
        setArticles((art.articles ?? []).filter((a: Article) => a.published));
      })
      .finally(() => setLoading(false));
  }, []);

  // Repos by year
  const reposByYear = repos.reduce<Record<string, number>>((acc, r) => {
    const year = new Date(r.createdAt).getFullYear().toString();
    acc[year] = (acc[year] ?? 0) + 1;
    return acc;
  }, {});
  const repoYearData = Object.entries(reposByYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, count]) => ({ year, repos: count }));

  // Top repos by stars
  const topReposByStars = [...repos]
    .sort((a, b) => b.stargazerCount - a.stargazerCount)
    .slice(0, 8)
    .map((r) => ({ name: r.name.slice(0, 16), stars: r.stargazerCount }));

  // Article reactions over time
  const articleTimeData = [...articles]
    .sort(
      (a, b) =>
        new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
    )
    .slice(-20)
    .map((a) => ({
      name: a.title.slice(0, 18) + "…",
      reactions: a.positive_reactions_count,
      comments: a.comments_count,
      views: Math.round((a.page_views_count ?? 0) / 10),
    }));

  // Reading time distribution
  const rtBuckets: Record<string, number> = {
    "< 3 min": 0,
    "3–7 min": 0,
    "7–15 min": 0,
    "> 15 min": 0,
  };
  articles.forEach((a) => {
    const rt = a.reading_time_minutes ?? 0;
    if (rt < 3) rtBuckets["< 3 min"]++;
    else if (rt < 7) rtBuckets["3–7 min"]++;
    else if (rt < 15) rtBuckets["7–15 min"]++;
    else rtBuckets["> 15 min"]++;
  });
  const rtData = Object.entries(rtBuckets).map(([name, value]) => ({
    name,
    value,
  }));

  const tooltipStyle = {
    backgroundColor: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "8px",
    color: "#e4e4e7",
    fontSize: "12px",
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-xl font-semibold text-zinc-100">Metrics</h1>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 bg-zinc-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Metrics</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Visual analytics for repos &amp; content
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Repos by Year */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Repos Created by Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            {repoYearData.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">
                No data
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={repoYearData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="repos" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top repos by stars */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Top Repos by Stars
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topReposByStars.every((r) => r.stars === 0) ? (
              <p className="text-xs text-zinc-500 text-center py-8">
                No starred repos yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topReposByStars} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="stars" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Article engagement */}
        <Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Article Engagement (last 20 articles)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {articleTimeData.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">
                No articles found — check DEVTO_API_KEY
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={articleTimeData}>
                  <defs>
                    <linearGradient
                      id="reactionsGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="#7c3aed"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="commentsGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="#6366f1"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#71717a", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: "#71717a" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="reactions"
                    stroke="#7c3aed"
                    fill="url(#reactionsGrad)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="comments"
                    stroke="#6366f1"
                    fill="url(#commentsGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Reading time distribution */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Reading Time Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {articles.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">
                No articles
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={rtData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rtData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: "#71717a" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Forks vs Stars scatter (bar approximation) */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Stars vs Forks (top repos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topReposByStars.every((r) => r.stars === 0) ? (
              <p className="text-xs text-zinc-500 text-center py-8">
                No data
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[...repos]
                    .sort((a, b) => b.stargazerCount - a.stargazerCount)
                    .slice(0, 6)
                    .map((r) => ({
                      name: r.name.slice(0, 12),
                      stars: r.stargazerCount,
                      forks: r.forkCount,
                    }))}
                >
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
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: "#71717a" }}
                  />
                  <Bar dataKey="stars" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="forks" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
