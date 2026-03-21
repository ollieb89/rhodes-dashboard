"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

function fmt(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface UpdatedAgoProps {
  fetchedAt: Date | null;
  className?: string;
}

export function UpdatedAgo({ fetchedAt, className = "" }: UpdatedAgoProps) {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!fetchedAt) return;
    setLabel(fmt(fetchedAt));
    const iv = setInterval(() => setLabel(fmt(fetchedAt)), 10_000);
    return () => clearInterval(iv);
  }, [fetchedAt]);

  if (!fetchedAt) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] text-zinc-600 ${className}`}>
      <Clock className="w-2.5 h-2.5" />
      Updated {label}
    </span>
  );
}
