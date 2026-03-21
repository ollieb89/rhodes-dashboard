"use client";

import Link from "next/link";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileText,
  Bot,
  BarChart3,
  Zap,
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
  useKeyboardNav();

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col z-20">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-100 leading-none">
              Rhodes
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              Command Center
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon, shortcut }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
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
      <div className="px-4 py-3 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-600">ollieb89 · local</p>
      </div>
    </aside>
  );
}
