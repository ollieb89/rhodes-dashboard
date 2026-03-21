"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, FileText, Bot, ExternalLink, X } from "lucide-react";
import { apiFetch } from "@/lib/api";


interface Repo {
  name: string;
  description: string;
  url: string;
}

interface Article {
  id: number;
  title: string;
  url: string;
}

interface Agent {
  id: string;
  name: string;
  status: string;
}

type ResultItem =
  | { kind: "repo"; id: string; label: string; sub: string; url: string }
  | { kind: "article"; id: string; label: string; sub: string; url: string }
  | { kind: "agent"; id: string; label: string; sub: string };

interface CacheData {
  repos: Repo[];
  articles: Article[];
  agents: Agent[];
}

let globalCache: CacheData | null = null;

async function loadCache(): Promise<CacheData> {
  if (globalCache) return globalCache;
  const [rRes, aRes, agRes] = await Promise.allSettled([
    apiFetch("/api/products").then((r) => r.json()),
    apiFetch("/api/articles").then((r) => r.json()),
    apiFetch("/api/agents").then((r) => r.json()),
  ]);
  const repos: Repo[] =
    rRes.status === "fulfilled" ? (rRes.value.repos ?? []) : [];
  const articles: Article[] =
    aRes.status === "fulfilled" ? (aRes.value.articles ?? []) : [];
  const agents: Agent[] =
    agRes.status === "fulfilled" ? (agRes.value.agents ?? []) : [];
  globalCache = { repos, articles, agents };
  return globalCache;
}

function buildResults(cache: CacheData, query: string): ResultItem[] {
  const q = query.toLowerCase().trim();
  const results: ResultItem[] = [];

  for (const r of cache.repos) {
    if (
      r.name.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q)
    ) {
      results.push({ kind: "repo", id: r.name, label: r.name, sub: r.description ?? "", url: r.url });
    }
  }
  for (const a of cache.articles) {
    if (a.title.toLowerCase().includes(q)) {
      results.push({ kind: "article", id: String(a.id), label: a.title, sub: "dev.to", url: a.url });
    }
  }
  for (const ag of cache.agents) {
    const name = ag.name || ag.id;
    if (name.toLowerCase().includes(q) || ag.status.toLowerCase().includes(q)) {
      results.push({ kind: "agent", id: ag.id, label: name, sub: ag.status });
    }
  }
  return results.slice(0, 12);
}

function kindIcon(kind: ResultItem["kind"]) {
  if (kind === "repo") return <Package className="w-3.5 h-3.5 text-violet-400 shrink-0" />;
  if (kind === "article") return <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  return <Bot className="w-3.5 h-3.5 text-green-400 shrink-0" />;
}

function kindLabel(kind: ResultItem["kind"]) {
  if (kind === "repo") return "Repo";
  if (kind === "article") return "Article";
  return "Agent";
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Pre-load cache
      setLoading(true);
      loadCache()
        .then((cache) => {
          setResults(buildResults(cache, ""));
        })
        .finally(() => setLoading(false));
    } else {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  // Filter on query change
  useEffect(() => {
    if (!open) return;
    if (!globalCache) return;
    setResults(buildResults(globalCache, query));
    setCursor(0);
  }, [query, open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = results[cursor];
        if (item) activate(item);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, cursor]);

  // Scroll cursor into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const activate = useCallback((item: ResultItem) => {
    setOpen(false);
    if (item.kind === "repo") window.open(item.url, "_blank", "noreferrer");
    else if (item.kind === "article") window.open(item.url, "_blank", "noreferrer");
    else router.push("/agents");
  }, [router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search repos, articles, agents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
          />
          {loading && (
            <span className="text-[10px] text-zinc-600 animate-pulse">loading...</span>
          )}
          <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {results.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
              <Search className="w-6 h-6 mb-2 opacity-40" />
              <p className="text-sm">{query ? "No results found" : "Start typing to search"}</p>
            </div>
          )}
          {results.map((item, idx) => (
            <button
              key={`${item.kind}-${item.id}`}
              data-idx={idx}
              onClick={() => activate(item)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                idx === cursor ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-800/60"
              }`}
            >
              {kindIcon(item.kind)}
              <div className="flex-1 min-w-0">
                <span className="text-sm truncate block">{item.label}</span>
                {item.sub && (
                  <span className="text-[10px] text-zinc-600 truncate block">{item.sub.slice(0, 80)}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">
                  {kindLabel(item.kind)}
                </span>
                {(item.kind === "repo" || item.kind === "article") && (
                  <ExternalLink className="w-3 h-3 text-zinc-600" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-600">
          <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1">↵</kbd> open</span>
          <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1">esc</kbd> close</span>
          <span className="ml-auto">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
