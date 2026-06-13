"use client";

import Link from "next/link";
import { NAVIGATION_SHORTCUTS } from "@/lib/shortcuts";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { usePins } from "@/hooks/use-pins";
import { apiFetch } from "@/lib/api";
import {
  LayoutDashboard, Package, FileText, Bot, BarChart3,
  Zap, Menu, X, Sun, Moon, AlertTriangle, Settings, Truck,
  Pin,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/content", label: "Content", icon: FileText },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/delivery", label: "Delivery", icon: Truck },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
].map((item) => {
  const shortcut = NAVIGATION_SHORTCUTS.find((entry) => entry.href === item.href);

  return {
    ...item,
    shortcut: shortcut?.keys[1],
  };
});

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { pins, toggle, isPinned } = usePins("sidebar");
  const [incidentCount, setIncidentCount] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  // Poll for incidents count
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await apiFetch("/api/incidents");
        if (res.ok) {
          const data = await res.json();
          const active = (data.incidents ?? []).filter((i: any) => 
            i.severity === "critical" || i.severity === "warning"
          ).length;
          setIncidentCount(active);
        }
      } catch (e) {}
    };
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);


  // Body scroll lock when mobile sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const { pinnedItems, regularItems } = useMemo(() => {
    const pinned = NAV_ITEMS.filter(item => pins.has(item.href));
    const regular = NAV_ITEMS.filter(item => !pins.has(item.href));
    return { pinnedItems: pinned, regularItems: regular };
  }, [pins]);

  const renderNavLink = (item: typeof NAV_ITEMS[0]) => {
    const { href, label, icon: Icon, shortcut } = item;
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    const pinned = isPinned(href);
    const isIncidents = href === "/incidents";

    return (
      <div key={href} className="group flex items-center gap-1 px-2">
        <Link
          href={href}
          className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            active
              ? "bg-violet-600/20 text-violet-300 font-medium"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="flex-1">{label}</span>
          {isIncidents && incidentCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full bg-red-500 text-white animate-in zoom-in duration-300">
              {incidentCount}
            </span>
          )}
          {shortcut && !isIncidents && (
            <kbd className="hidden group-hover:inline-flex items-center text-[9px] font-mono text-zinc-600 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 leading-none">
              g{shortcut}
            </kbd>
          )}
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(href);
          }}
          className={`p-1.5 rounded-md transition-all ${
            pinned 
              ? "text-violet-400 opacity-100 bg-violet-400/10" 
              : "text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-400 hover:bg-zinc-800"
          }`}
          title={pinned ? "Unpin from favorites" : "Pin to favorites"}
        >
          <Pin className={`w-3.5 h-3.5 ${pinned ? "fill-current" : ""}`} />
        </button>
      </div>
    );
  };

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-4 py-5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-100 leading-none">Rhodes</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Command Center</div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="md:hidden text-zinc-500 hover:text-zinc-300 p-2 rounded min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-1 py-3 space-y-4 overflow-y-auto">
        {pinnedItems.length > 0 && (
          <div className="space-y-1">
            <div className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Favorites
            </div>
            {pinnedItems.map(renderNavLink)}
          </div>
        )}

        <div className="space-y-1">
          {pinnedItems.length > 0 && (
            <div className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Menu
            </div>
          )}
          {regularItems.map(renderNavLink)}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
        <p className="text-[10px] text-zinc-600">ollieb89 · local</p>
        {mounted && (
          <button
            onClick={toggleTheme}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-800"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Hamburger toggle — mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-8 left-3 z-40 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-md p-2 min-h-11 min-w-11 flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col z-50 transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
