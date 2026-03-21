# Batch 6 — Dashboard v1.0 Polish & Deploy-Ready

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Final polish for a deployable v1.0 — SSE real-time updates, settings page, mobile responsive pass, PWA manifest, and README/CHANGELOG.

**Architecture:** Next.js 15 App Router frontend + FastAPI backend. Existing polling via useFetchWithTimestamp hook. Sidebar nav with keyboard shortcuts. shadcn/ui component library. Recharts for charts. Tailwind CSS v4. Vitest + Playwright + pytest for testing.

**Tech Stack:** Next.js, FastAPI, TypeScript, Python, Tailwind CSS, shadcn/ui, Recharts, Vitest, Playwright, pytest

**Project root:** ~/Development/Projects/rhodes-dashboard

**Commit pattern:** One commit per task, prefixed feat: DASH-0XX description

**Red lines:**
- All existing tests must still pass (vitest + pytest + playwright)
- No breaking changes to existing API endpoints
- SSE must degrade gracefully — if backend doesn't support it, polling continues

---

## Pre-flight: Verify existing tests pass

Before any changes, run all test suites to establish baseline.

---

### Task 1: DASH-041 — Real-time updates via SSE

Create backend/sse.py with SSEManager class (subscribe/unsubscribe/broadcast pattern). Add /api/events SSE endpoint to main.py with keepalive every 30s. Create frontend/hooks/use-sse.ts with reconnection and polling fallback. Integrate with useFetchWithTimestamp — when SSE connected, skip polling; when disconnected, resume polling. Write tests for both backend and frontend. Commit.

### Task 2: DASH-042 — Settings page

Create frontend/hooks/use-settings.ts with localStorage persistence. Settings: apiUrl, refreshInterval (10s/30s/60s/120s), theme. Create /settings page with shadcn Card sections. Add Settings to sidebar nav (lucide Settings icon, shortcut s). Write hook tests. Commit.

### Task 3: DASH-043 — Mobile responsive pass

Audit all pages at 375px/768px. Fix sidebar overlay (backdrop, prevent body scroll, z-index). Update grids to cols-1 mobile, cols-2 tablet. Add overflow-x-auto to tables. Ensure 44px touch targets. Reduce heading sizes at mobile. Commit.

### Task 4: DASH-044 — PWA manifest + favicon

Create manifest.json, generate placeholder icons (192/512/apple-touch). Create offline fallback page. Update layout.tsx metadata with manifest link, icons, OG tags, mobile-web-app-capable. Commit.

### Task 5: DASH-045 — README + CHANGELOG

Write comprehensive README.md with features, quick start, architecture, testing, config sections. Auto-generate CHANGELOG from git history. Create docs/screenshots/ placeholder. Commit.

## Post-flight: Verify all tests pass
