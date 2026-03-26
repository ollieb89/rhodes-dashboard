"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Terminal, Copy, Pause, Play, Trash2 } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api";

interface LogsPanelProps {
  agentId: string;
}

export function LogsPanel({ agentId }: LogsPanelProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const pausedRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<string[]>([]);
  const shouldScrollRef = useRef(true);

  const appendLine = useCallback((line: string) => {
    if (pausedRef.current) return;
    linesRef.current = [...linesRef.current, line].slice(-500);
    setLines([...linesRef.current]);
  }, []);

  // Load initial lines
  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/crons/${agentId}/logs/tail?lines=500`)
      .then((r) => r.json())
      .then((data) => {
        const initialLines = data.lines || [];
        linesRef.current = initialLines;
        setLines(initialLines);
      })
      .catch(() => {
        linesRef.current = ["Failed to load logs"];
        setLines(linesRef.current);
      })
      .finally(() => setLoading(false));
  }, [agentId]);

  // Connect to SSE stream
  useEffect(() => {
    if (loading) return;

    const connect = () => {
      if (esRef.current) {
        esRef.current.close();
      }
      const es = new EventSource(apiUrl(`/api/crons/${agentId}/logs/stream`));
      esRef.current = es;
      setConnected(false);

      es.onopen = () => setConnected(true);
      es.onmessage = (e) => {
        setConnected(true);
        appendLine(e.data);
      };
      es.onerror = () => {
        setConnected(false);
        es.close();
        setTimeout(() => {
          if (esRef.current === es) connect();
        }, 5000);
      };
    };

    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [agentId, loading, appendLine]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!paused && terminalRef.current && shouldScrollRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, paused]);

  // Track user scroll to disable auto-scroll when scrolled up
  const handleScroll = useCallback(() => {
    if (!terminalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
  };

  const clearLogs = () => {
    linesRef.current = [];
    setLines([]);
  };

  const copyToClipboard = async () => {
    const text = linesRef.current.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={togglePause}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            paused
              ? "border-green-700/50 text-green-400 hover:border-green-600"
              : "border-zinc-700 text-zinc-400 hover:border-amber-700 hover:text-amber-400"
          }`}
        >
          {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
        </button>
        <button
          onClick={clearLogs}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-red-700 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Clear
        </button>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-violet-700 hover:text-violet-400 transition-colors"
        >
          <Copy className="w-3 h-3" /> {copied ? "Copied!" : "Copy"}
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-zinc-600"}`}
            title={connected ? "Connected" : "Connecting..."}
          />
          <span className="text-[10px] text-zinc-500">
            {lines.length} lines
            {paused && <span className="ml-2 text-amber-500 font-medium">PAUSED</span>}
          </span>
        </div>
      </div>

      <div
        ref={terminalRef}
        onScroll={handleScroll}
        className="h-[400px] overflow-y-auto font-mono text-[11px] text-green-400/90 bg-zinc-950 border border-zinc-800 rounded-lg p-4 leading-relaxed whitespace-pre-wrap break-all"
      >
        {loading ? (
          <span className="text-zinc-600">Loading logs...</span>
        ) : lines.length === 0 ? (
          <span className="text-zinc-600">
            {connected ? "Waiting for log entries..." : "Connecting to log stream..."}
          </span>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="hover:bg-zinc-900/50 px-1 -mx-1">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
