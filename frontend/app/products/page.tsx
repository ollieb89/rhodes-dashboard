"use client";

import { useEffect, useState } from "react";
import { Star, GitFork, ExternalLink, Package, ArrowUpDown, Download, CheckCircle, XCircle, Loader, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/error-boundary";

const API = "http://localhost:8521";
type SortKey = "stars" | "forks" | "newest";

interface Repo {
  name: string; description: string; stargazerCount: number;
  forkCount: number; createdAt: string; url: string;
  primaryLanguage: { name: string; color: string } | null;
}
interface CiRun { status: string; conclusion: string; name: string; branch: string; url: string; }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const SORT_LABELS: Record<SortKey, string> = { stars: "Stars", forks: "Forks", newest: "Newest" };
const SORT_ORDER: SortKey[] = ["stars", "forks", "newest"];

function sortRepos(repos: Repo[], key: SortKey): Repo[] {
  return [...repos].sort((a, b) => {
    if (key === "stars") return b.stargazerCount - a.stargazerCount;
    if (key === "forks") return b.forkCount - a.forkCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""')+'"';
  }
  return s;
}

function downloadCsv(rows: Repo[]) {
  const headers = ["Rank","Name","Description","Stars","Forks","Language","Created","URL"];
  const lines = [headers.join(","), ...rows.map((r,i) => [i+1, escapeCsv(r.name), escapeCsv(r.description), r.stargazerCount, r.forkCount, escapeCsv(r.primaryLanguage?.name ?? ""), escapeCsv(r.createdAt), escapeCsv(r.url)].join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "repos.csv"; a.click();
  URL.revokeObjectURL(url);
}

function CiBadge({ run }: { run: CiRun | undefined }) {
  if (!run) return null;
  const conclusion = run.conclusion?.toLowerCase();
  const status = run.status?.toLowerCase();
  let colorClass = "border-zinc-700 text-zinc-500 bg-zinc-800/50";
  let icon = <Circle className="w-2.5 h-2.5" />;
  let label = conclusion || status || "unknown";
  if (conclusion === "success") {
    colorClass = "border-green-800/50 text-green-400 bg-green-950/30";
    icon = <CheckCircle className="w-2.5 h-2.5" />;
    label = "passing";
  } else if (conclusion === "failure" || conclusion === "cancelled") {
    colorClass = "border-red-800/50 text-red-400 bg-red-950/30";
    icon = <XCircle className="w-2.5 h-2.5" />;
    label = conclusion === "cancelled" ? "cancelled" : "failing";
  } else if (status === "in_progress" || status === "queued" || status === "waiting") {
    colorClass = "border-amber-800/50 text-amber-400 bg-amber-950/30";
    icon = <Loader className="w-2.5 h-2.5 animate-spin" />;
    label = status === "queued" ? "queued" : "running";
  }
  const cls = `inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium transition-opacity hover:opacity-80 ${colorClass}`;
  return (
    <a href={run.url} target="_blank" rel="noreferrer" className={cls} title={`${run.name} on ${run.branch}`}>
      {icon} {label}
    </a>
  );
}

export default function ProductsPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [ciRuns, setCiRuns] = useState<Record<string, CiRun>>({});
  const [loading, setLoading] = useState(true);
  const [ciLoading, setCiLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("stars");

  useEffect(() => {
    fetch(`${API}/api/products`).then((r) => r.json()).then((d) => setRepos(d.repos ?? [])).catch(() => setError("Backend unavailable")).finally(() => setLoading(false));
    fetch(`${API}/api/ci`).then((r) => r.json()).then((d) => setCiRuns(d.runs ?? {})).catch(() => {}).finally(() => setCiLoading(false));
  }, []);

  const cycleSort = () => { const idx = SORT_ORDER.indexOf(sortKey); setSortKey(SORT_ORDER[(idx + 1) % SORT_ORDER.length]); };
  const filtered = repos.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || (r.description ?? "").toLowerCase().includes(search.toLowerCase()));
  const sorted = sortRepos(filtered, sortKey);

  return (
    <ErrorBoundary>
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Products</h1>
            <p className="text-sm text-zinc-500 mt-1">GitHub repos for ollieb89 ({repos.length} total)</p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && sorted.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => downloadCsv(sorted)} className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={cycleSort} className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 text-xs gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5" /> {SORT_LABELS[sortKey]}
            </Button>
            <input type="text" placeholder="Search repos..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm rounded-lg px-3 py-2 outline-none focus:border-violet-500 w-52" />
          </div>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading
            ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-32 bg-zinc-800 rounded-xl" />)
            : sorted.map((repo, idx) => (
                <Card key={repo.name} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors group">
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-zinc-600 font-mono shrink-0 w-5 text-right">#{idx + 1}</span>
                        <Package className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <a href={repo.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-zinc-200 group-hover:text-violet-300 truncate transition-colors">{repo.name}</a>
                      </div>
                      <a href={repo.url} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-zinc-400 shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 mb-2">{repo.description || "No description"}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {repo.primaryLanguage && (
                        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 py-0 px-1.5 gap-1">
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: repo.primaryLanguage.color ?? "#52525b" }} />
                          {repo.primaryLanguage.name}
                        </Badge>
                      )}
                      {!ciLoading && <CiBadge run={ciRuns[repo.name]} />}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3" />{repo.stargazerCount}</span>
                      <span className="flex items-center gap-1"><GitFork className="w-3 h-3" />{repo.forkCount}</span>
                      <span className="ml-auto">{timeAgo(repo.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <Package className="w-8 h-8 mb-2" /><p className="text-sm">No repositories found</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
