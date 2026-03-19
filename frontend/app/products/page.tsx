"use client";

import { useEffect, useState } from "react";
import { Star, GitFork, ExternalLink, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const API = "http://localhost:8521";

interface Repo {
  name: string;
  description: string;
  stargazerCount: number;
  forkCount: number;
  createdAt: string;
  url: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function ProductsPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then((r) => r.json())
      .then((d) => setRepos(d.repos ?? []))
      .catch(() => setError("Backend unavailable"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Products</h1>
          <p className="text-sm text-zinc-500 mt-1">
            GitHub repos for ollieb89 ({repos.length} total)
          </p>
        </div>
        <input
          type="text"
          placeholder="Search repos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm rounded-lg px-3 py-2 outline-none focus:border-violet-500 w-52"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading
          ? Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-32 bg-zinc-800 rounded-xl" />
            ))
          : filtered.map((repo) => (
              <Card
                key={repo.name}
                className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors group"
              >
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-zinc-200 group-hover:text-violet-300 truncate transition-colors"
                      >
                        {repo.name}
                      </a>
                    </div>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-600 hover:text-zinc-400 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 mb-3">
                    {repo.description || "No description"}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    {repo.stargazerCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {repo.stargazerCount}
                      </span>
                    )}
                    {repo.forkCount > 0 && (
                      <span className="flex items-center gap-1">
                        <GitFork className="w-3 h-3" />
                        {repo.forkCount}
                      </span>
                    )}
                    <span className="ml-auto">{timeAgo(repo.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
          <Package className="w-8 h-8 mb-2" />
          <p className="text-sm">No repositories found</p>
        </div>
      )}
    </div>
  );
}
