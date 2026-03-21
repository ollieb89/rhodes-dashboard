# Rhodes Command Center — Backlog

Tasks are ordered for sequential pickup by the cron agent. Pick the first `[ ]` task, implement it, mark it `[x]`, commit, and stop.

**Complexity:** S = ~30 min, M = ~60 min, L = ~90 min
**Priority:** P0 = broken/blocking, P1 = important, P2 = nice-to-have

---

## How the cron agent should use this file

1. Find the first unchecked task (`[ ]`)
2. Read its full description and acceptance criteria
3. Implement it — no more, no less
4. Mark it `[x]` and commit
5. Stop (do not pick up the next task in the same session)

---

## Backlog

### P0 — Critical

- [x] **DASH-001** · S · Fix /api/agents to return structured cron data

  The current `parse_openclaw_table` in `backend/main.py` is fragile and returns inconsistent field names. Replace it with a direct `openclaw cron list --json` call (if supported) or normalise the parsed output to always return objects with keys: `id`, `name`, `schedule`, `status`, `last_run`, `next_run`. Fall back gracefully if openclaw is not installed. Update `GET /api/agents` response shape accordingly.

  **Acceptance criteria:**
  - `/api/agents` always returns `{ agents: Array<{ id, name, schedule, status, last_run?, next_run? }>, total, error? }`
  - No KeyError / missing-key crashes when openclaw output format varies
  - Test by hitting the endpoint manually and confirming consistent keys

---

- [x] **DASH-002** · S · Add `GET /api/crons/{id}/run` endpoint

  Add a new FastAPI endpoint that triggers a specific cron job by its ID via `openclaw cron run <id>`. Return `{ ok: true, output: string }` on success or `{ ok: false, error: string }` on failure. Keep the timeout short (15 s) — just enough to confirm the job was kicked off, not to wait for completion. Add the endpoint to `backend/main.py`.

  **Acceptance criteria:**
  - `POST /api/crons/{id}/run` triggers `openclaw cron run <id>` subprocess
  - Returns JSON with `ok` boolean and either `output` or `error`
  - Handles `FileNotFoundError` (openclaw not installed) gracefully

---

- [x] **DASH-003** · S · Fix overview page agent "Active" count

  The current "Active" count in `frontend/app/page.tsx` scans all string values of each agent object for the word "active" — this is incorrect and will always return 0 with the current openclaw output. Fix it to use the normalised `status` field from DASH-001's updated `/api/agents` response: count agents where `status === "active"` or `status === "running"`. If DASH-001 is not done yet, hardcode to check `agent.status` only.

  **Acceptance criteria:**
  - Active count correctly reflects agents with status `active` or `running`
  - No scanning of arbitrary string values

---

### P1 — Important

- [x] **DASH-004** · M · Build a `/api/metrics` endpoint with aggregated stats

  Add `GET /api/metrics` to `backend/main.py`. It should call `/api/products` and `/api/articles` internally (or reuse the helper functions) and return:
  ```json
  {
    "total_stars": 42,
    "total_forks": 7,
    "total_repos": 12,
    "total_articles": 8,
    "total_article_views": 3200,
    "total_article_reactions": 89,
    "top_repo": { "name": "...", "stars": 30, "url": "..." },
    "top_article": { "title": "...", "views": 1200, "url": "..." }
  }
  ```
  Use `asyncio.gather` for concurrent fetching. Article `page_views_count` and `public_reactions_count` come from the dev.to API response fields.

  **Acceptance criteria:**
  - Endpoint responds in < 5 s
  - All fields present (0 if data unavailable)
  - `top_repo` and `top_article` are the highest-value items by stars/views respectively

---

- [x] **DASH-005** · M · Build out the Metrics page with real data

  The `frontend/app/metrics/page.tsx` page currently exists but is likely a placeholder. Replace it with a real metrics page that calls `/api/metrics` (from DASH-004) and displays:
  - Four stat cards: Total Stars, Total Forks, Article Views, Article Reactions
  - A ranked list of repos sorted by star count (name + stars + forks)
  - A ranked list of articles sorted by view count (title + views + reactions)

  Use the existing `StatCard` component and shadcn `Card`. Follow the same dark theme pattern as `page.tsx` (overview). Auto-refresh every 60 s.

  **Acceptance criteria:**
  - Page loads data from `/api/metrics` with loading skeletons
  - Shows top repos and top articles ranked by value
  - Handles backend offline gracefully with an error state

---

- [x] **DASH-006** · M · Add cron health card to Overview page

  Add a "Cron Health" card to `frontend/app/page.tsx` alongside the existing two cards. It should:
  - Fetch from `/api/agents`
  - Show a row per agent with name, schedule, and a status badge (green = active/running, amber = paused, grey = unknown)
  - Show a summary line: "N of M agents active"
  - Limit to 6 agents max with a "View all →" link to the `/agents` page

  **Acceptance criteria:**
  - Card renders with proper loading skeleton
  - Status badge colour matches agent status
  - Summary line is accurate

---

- [x] **DASH-007** · M · Improve the Agents page with a proper list and run button

  Rewrite `frontend/app/agents/page.tsx` to:
  - Show all agents from `/api/agents` as a full table/list with columns: Name, Schedule, Status, Last Run, Actions
  - Add a "Run now" button per agent that calls `POST /api/crons/{id}/run` (from DASH-002) and shows a toast/inline success or error message
  - Show the raw openclaw output in a collapsible `<details>` block for debugging

  Use shadcn `Table` or card-per-row layout. Match dark theme.

  **Acceptance criteria:**
  - All agents listed with correct fields
  - "Run now" button calls the API and shows feedback
  - Page handles missing openclaw gracefully

---

- [x] **DASH-008** · M · Add SQLite-backed history snapshots to the backend

  Add a lightweight persistence layer to `backend/main.py`:
  - On each call to `/api/overview`, save a snapshot row to a SQLite DB (`backend/history.db`) with columns: `id`, `timestamp`, `total_repos`, `total_stars`, `total_articles`, `total_agents`
  - Add `GET /api/history?days=7` endpoint that returns the last N days of snapshots as a list
  - Use Python's built-in `sqlite3` module — no new dependencies

  **Acceptance criteria:**
  - `history.db` is created automatically on first run
  - `/api/history` returns an array of `{ timestamp, total_repos, total_stars, total_articles, total_agents }` objects
  - Snapshots accumulate over time; old rows are kept (no pruning needed yet)

---

- [x] **DASH-009** · M · Add sparkline trend charts to Overview stat cards

  Using the history data from DASH-008's `/api/history`, add small sparkline charts beneath the stat cards on the overview page. Each card (Repos, Articles, Agents) should show a 7-day trend line.

  Use `recharts` — it's likely already available given the Next.js stack, or install it via `npm install recharts`. Render a `<LineChart>` with no axes, no legend, just the line — 120 × 40 px.

  **Acceptance criteria:**
  - Sparklines appear under each stat card when history data is available
  - Cards still look correct when history is empty (no sparkline rendered)
  - No new layout breakage on smaller screens

---

- [x] **DASH-010** · S · Improve the Products page sorting and layout

  `frontend/app/products/page.tsx` currently lists repos. Improve it:
  - Sort repos by `stargazerCount` descending by default
  - Add a sort toggle button: Stars ↕ / Forks ↕ / Newest ↕
  - Display a rank number (#1, #2, …) next to each repo name
  - Show fork count alongside star count in the row

  No new components — use existing shadcn `Button` for the toggle and inline layout tweaks.

  **Acceptance criteria:**
  - Default sort is by stars desc
  - Clicking sort toggle cycles through stars/forks/date
  - Rank number displayed

---

- [x] **DASH-011** · S · Improve the Content page with article stats

  `frontend/app/content/page.tsx` lists dev.to articles. Enhance it to show per-article stats from the dev.to API response (`page_views_count`, `public_reactions_count`, `comments_count`):
  - Show views, reactions, and comments count on each article row
  - Sort articles by `page_views_count` descending by default
  - Add a total summary line at the top: "X total views · Y reactions across N articles"

  **Acceptance criteria:**
  - Stats visible on each article row
  - Sorted by views by default
  - Summary line accurate

---

- [x] **DASH-012** · S · Add error boundary component to prevent full-page crashes

  Create `frontend/components/error-boundary.tsx` — a React error boundary that catches render errors in child components and shows a fallback card with the error message and a "Retry" button that resets state.

  Wrap each page's main content section with `<ErrorBoundary>`. This prevents a single failing widget from taking down the whole page.

  **Acceptance criteria:**
  - `ErrorBoundary` component exists and is used on all 5 pages
  - On render error, shows a contained error card (not a blank page)
  - "Retry" button resets the boundary

---

- [x] **DASH-013** · M · Add HN mentions section to Content page

  Add a "HN Mentions" section to `frontend/app/content/page.tsx` below the articles list. Call `/api/hn?query=<term>` (defaulting to "workflow-guardian") and display:
  - Post title (linked), points, comment count, posted date
  - A text input to change the search query with a search button

  Reuse the existing card component pattern.

  **Acceptance criteria:**
  - HN section renders below articles
  - Search input changes the query and re-fetches
  - Empty state when no results found

---

- [x] **DASH-014** · M · Add `/api/crons` endpoint with enable/disable actions

  Extend `backend/main.py` with:
  - `GET /api/crons` — same as `/api/agents` but with the normalised structure from DASH-001
  - `POST /api/crons/{id}/enable` — calls `openclaw cron enable <id>`
  - `POST /api/crons/{id}/disable` — calls `openclaw cron disable <id>`

  Add enable/disable buttons to the Agents page (from DASH-007) that call these endpoints and refresh the list.

  **Acceptance criteria:**
  - Three new endpoints defined and working
  - Agents page shows enable/disable buttons that work
  - UI refreshes agent list after action

---

### P2 — Nice-to-have

- [x] **DASH-015** · S · Add keyboard shortcuts for sidebar navigation

  Add `useEffect`-based keyboard listeners in `frontend/components/sidebar.tsx` (or a new hook `frontend/hooks/use-keyboard-nav.ts`). Shortcuts: `g o` = Overview, `g p` = Products, `g c` = Content, `g a` = Agents, `g m` = Metrics. Use Next.js `router.push()` for navigation.

  **Acceptance criteria:**
  - All 5 shortcuts work in the browser
  - No conflict with browser shortcuts (use `g` + letter chord, not bare letters)

---

- [x] **DASH-016** · S · Add a "Last N runs" history view to the Agents page

  Using `/api/history` from DASH-008, add a small "Agent count over time" chart (7-day line) to the top of `frontend/app/agents/page.tsx`. Shows how the number of registered cron agents has changed.

  **Acceptance criteria:**
  - Chart visible at top of agents page
  - Uses recharts `LineChart` consistent with DASH-009 style
  - Empty state handled

---

- [x] **DASH-017** · S · Add repo language tags to Products page

  Update `GET /api/products` in `backend/main.py` to include `primaryLanguage` in the GitHub CLI `--json` fields list. Display language as a small badge on each repo row using shadcn `Badge`.

  **Acceptance criteria:**
  - Language field returned in API response
  - Badge visible per repo (hidden if null)

---

- [x] **DASH-018** · M · Add a system health bar to the top of all pages

  Add a thin status bar component `frontend/components/health-bar.tsx` that appears at the very top of the layout (above the sidebar content, spanning full width). It polls `GET /api/overview` every 30 s and shows:
  - Green dot + "All systems operational" when data loads fine
  - Amber dot + "Backend slow" when response > 3 s
  - Red dot + "Backend offline" when fetch fails

  Add it to `frontend/app/layout.tsx`.

  **Acceptance criteria:**
  - Health bar visible on all pages
  - Status updates every 30 s
  - Does not break existing layout

---

- [x] **DASH-019** · S · Add data export (CSV download) to Products and Content pages

  Add a "Export CSV" button to `frontend/app/products/page.tsx` and `frontend/app/content/page.tsx`. On click, serialise the current in-memory data to CSV and trigger a browser download using a `data:` URL or `Blob`. No server-side changes needed.

  **Acceptance criteria:**
  - Button visible on both pages
  - CSV download works in browser
  - CSV includes all visible columns

---

- [x] **DASH-020** · M · Make the dashboard mobile-responsive

  The sidebar is currently fixed at `ml-56` which breaks on small screens. Update `frontend/app/layout.tsx` and `frontend/components/sidebar.tsx` to:
  - Collapse sidebar to icon-only at < 768 px breakpoint
  - Add a hamburger toggle button to show/hide sidebar on mobile
  - Ensure grid layouts use `grid-cols-1` on small screens

  **Acceptance criteria:**
  - Dashboard usable on a 375 px wide viewport
  - Sidebar toggleable on mobile
  - No horizontal scroll on any page

---

## Completed

*(Implemented tasks move here)*
- **DASH-001** · S · Fix /api/agents to return structured cron data
- **DASH-003** · S · Fix overview page agent "Active" count
- **DASH-005** · M · Build out the Metrics page with real data
- **DASH-006** · M · Add cron health card to Overview page
- **DASH-007** · M · Improve the Agents page with a proper list and run button

---

## Batch 2 — New Features

### P1 — Important

- [x] **DASH-021** · L · Live log streaming on Agents page

  Add a real-time log tail to `frontend/app/agents/page.tsx`. Use FastAPI's `StreamingResponse` with Server-Sent Events (SSE) — no WebSocket dependency needed.

  **Backend (`backend/main.py`):**
  - Add `GET /api/logs/stream` — runs `openclaw cron logs --follow` (or `tail -f` of the openclaw log file) as a subprocess, streams each line as `data: <line>\n\n` SSE events
  - Add `GET /api/logs/recent?lines=100` — returns last N lines as `{ lines: string[] }`
  - Cap stream at 500 lines then reconnect automatically (prevent memory leak)

  **Frontend:**
  - Add a "Logs" collapsible panel at the bottom of the Agents page
  - Use `EventSource` to consume the SSE stream
  - Render lines in a dark `<pre>` terminal box, auto-scrolling to bottom
  - Add a "Pause / Resume" toggle and a "Clear" button
  - Limit display buffer to 200 lines (drop oldest)

  **Acceptance criteria:**
  - SSE endpoint streams log lines in real time
  - Frontend connects on mount, reconnects on disconnect
  - Pause/resume works without closing the connection
  - Graceful fallback if log file not found (show "No log source available")

---

- [ ] **DASH-022** · M · GitHub Actions CI status on Products page

  Show the latest CI run status per repo on `frontend/app/products/page.tsx`.

  **Backend (`backend/main.py`):**
  - Add `GET /api/ci` — calls `gh run list --json status,conclusion,name,headBranch,createdAt,url --limit 1` per repo (use `asyncio.gather` across repos)
  - Return `{ runs: { [repoName]: { status, conclusion, name, branch, url } } }`
  - Cache result for 60 s to avoid hammering GitHub API

  **Frontend:**
  - On each repo card, add a small CI badge below the language badge
  - Badge colours: green = success, red = failure, amber = in_progress/queued, grey = no runs
  - Badge shows: ✓ / ✗ / ⟳ icon + conclusion text
  - Clicking badge opens the run URL

  **Acceptance criteria:**
  - CI status visible on repo cards
  - Badge colour matches run conclusion
  - Missing CI data (new repos) shows nothing, not an error

---

- [ ] **DASH-023** · M · Notifications / events panel

  Surface openclaw system events in the dashboard as a slide-in notification panel.

  **Backend (`backend/main.py`):**
  - Add `GET /api/events?limit=20` — reads the openclaw event log (JSON lines from `openclaw system events` or from `~/.openclaw/logs/events.jsonl`)
  - Return `{ events: Array<{ id, timestamp, type, text, level }> }`
  - Add `POST /api/events/clear` — truncates the events file

  **Frontend:**
  - Add a bell icon button to the top-right of the health bar (or sidebar footer)
  - Clicking opens a slide-in panel from the right (fixed, `w-80`)
  - Panel shows events as a scrollable list: timestamp, level badge, message text
  - Unread count badge on the bell icon (count since last open, persisted in `localStorage`)
  - "Clear all" button at top of panel

  **Acceptance criteria:**
  - Panel opens/closes with bell button and ESC key
  - Events load from backend with loading skeleton
  - Unread count resets on open
  - Empty state shown when no events

---

### P2 — Nice-to-have

- [ ] **DASH-024** · S · Dark/light theme toggle

  Add a theme toggle to the sidebar footer. Use `next-themes` for theme management (install via `npm install next-themes`).

  **Setup:**
  - Wrap `frontend/app/layout.tsx` body in `<ThemeProvider attribute="class" defaultTheme="dark">`
  - Remove hardcoded `dark` class from `<html>`

  **Sidebar toggle:**
  - Add a sun/moon icon button in the sidebar footer next to the "ollieb89 · local" text
  - Use `useTheme()` from `next-themes` to toggle

  **CSS:**
  - Audit `globals.css` and component classes — most are already Tailwind dark-mode-compatible since everything uses `bg-zinc-*` and `text-zinc-*`
  - Light theme target: `bg-zinc-100` body, `bg-white` cards, `text-zinc-900` text

  **Acceptance criteria:**
  - Toggle switches between dark and light
  - Preference persisted in `localStorage` via next-themes
  - No flash of wrong theme on load (use `suppressHydrationWarning` on `<html>`)

---

- [ ] **DASH-025** · S · Pin/favourite repos and articles

  Allow Ollie to pin repos and articles to the top of their respective pages. Pins persist in `localStorage`.

  **Products page:**
  - Add a star/pin button to each repo card (top-right corner, replaces the external link icon row)
  - Pinned repos always appear first in the sorted list, with a subtle pin indicator

  **Content page:**
  - Add a pin button to each article row
  - Pinned articles appear at the top of the dev.to tab

  **Implementation:**
  - Custom hook `frontend/hooks/use-pins.ts` — `usePins(namespace: string)` returns `{ pins: Set<string>, toggle(id), isPinned(id) }`
  - Store in `localStorage` as `pins:<namespace>` JSON array
  - No backend changes needed

  **Acceptance criteria:**
  - Pins survive page refresh
  - Pinned items appear first, visually distinguished (e.g. violet pin icon)
  - Unpinning restores normal sort order

