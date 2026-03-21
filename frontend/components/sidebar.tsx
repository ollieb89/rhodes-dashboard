"use client";

import Link from "next/link";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, Package, FileText, Bot, BarChart3,
  Zap, Menu, X, Sun, Moon,
} from "lucide-react";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard, shortcut: "o" },
  { href: "/products", label: "Products", icon: Package, shortcut: "p" },
  { href: "/content", label: "Content", icon: FileText, shortcut: "c" },
  { href: "/agents", label: "Agents", icon: Bot, shortcut: "a" },
  { href: "/metrics", label: "Metrics", icon: BarChart3, shortcut: "m" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useKeyboardNav();

  useEffect(() => { setMounted(true); }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

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
          className="md:hidden text-zinc-500 hover:text-zinc-300 p-1 rounded"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon, shortcut }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-violet-600/20 text-violet-300 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <kbd className="hidden group-hover:inline-flex items-center text-[9px] font-mono text-zinc-600 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 leading-none">
                g{shortcut}
              </kbd>
            </Link>
          );
        })}
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
        className="md:hidden fixed top-8 left-3 z-30 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-md p-1.5"
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40 transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
