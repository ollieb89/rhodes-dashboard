"use client";

import React from "react";
import { AlertCircle, AlertTriangle, X } from "lucide-react";

interface AlertBannerProps {
  severity: "critical" | "warning";
  title: string;
  message?: string;
  onClose?: () => void;
}

export function AlertBanner({ severity, title, message, onClose }: AlertBannerProps) {
  const isCritical = severity === "critical";
  const bg = isCritical ? "bg-red-500/15 border-red-500/30" : "bg-amber-500/15 border-amber-500/30";
  const text = isCritical ? "text-red-400" : "text-amber-400";
  const icon = isCritical ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${bg} ${text} animate-in fade-in slide-in-from-top-2 duration-300`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-none">{title}</p>
        {message && <p className="text-xs mt-1 opacity-90 leading-relaxed">{message}</p>}
      </div>
      {onClose && (
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
