"use client";

import { useSettings } from "@/hooks/use-settings";
import { useLayout } from "@/hooks/use-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, RotateCcw, Trash2, Plus, Send } from "lucide-react";
import { useEffect, useState } from "react";

interface AlertRule {
  id: string;
  metric: string;
  operator: string;
  threshold: number;
  window_minutes: number;
  notify_channel: string;
  created_at: string;
  enabled: boolean;
}

const METRIC_LABELS: Record<string, string> = {
  active_agents: "Active Agents",
  total_stars: "Total Stars",
  total_repos: "Total Repos",
  total_articles: "Total Articles",
  total_article_views: "Article Views",
};

const OPERATORS = ["<", ">", "<=", ">=", "=="];

function AlertRulesSection({ apiUrl }: { apiUrl: string }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("active_agents");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchRules = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/alerts/rules`);
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const handleAdd = async () => {
    const thresh = parseFloat(threshold);
    if (isNaN(thresh)) return;
    setAdding(true);
    try {
      await fetch(`${apiUrl}/api/alerts/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric, operator, threshold: thresh }),
      });
      setThreshold("");
      await fetchRules();
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${apiUrl}/api/alerts/rules/${id}`, { method: "DELETE" });
    await fetchRules();
  };

  const inputClass =
    "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent h-11";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Rules</CardTitle>
        <CardDescription>
          Trigger events when metrics cross thresholds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className={inputClass}
            >
              {Object.entries(METRIC_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Operator</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className={inputClass + " w-24"}
            >
              {OPERATORS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Threshold</label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0"
              className={inputClass + " w-28"}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !threshold}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors h-11 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>

        {/* Rules list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 rounded bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-zinc-500">No alert rules configured.</p>
        ) : (
          <div className="rounded-md border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="text-left px-3 py-2 font-medium">Metric</th>
                  <th className="text-left px-3 py-2 font-medium">Operator</th>
                  <th className="text-left px-3 py-2 font-medium">Threshold</th>
                  <th className="text-left px-3 py-2 font-medium">Enabled</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-zinc-800 last:border-0">
                    <td className="px-3 py-2 text-zinc-200">
                      {METRIC_LABELS[rule.metric] ?? rule.metric}
                    </td>
                    <td className="px-3 py-2 text-zinc-400 font-mono">{rule.operator}</td>
                    <td className="px-3 py-2 text-zinc-200">{rule.threshold}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          rule.enabled
                            ? "text-xs text-emerald-400"
                            : "text-xs text-zinc-500"
                        }
                      >
                        {rule.enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  created_at: string;
}

const ALL_EVENTS = ["alert", "incident", "agent_failure"];

function WebhooksSection({ apiUrl }: { apiUrl: string }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["alert"]);
  const [secret, setSecret] = useState("");
  const [adding, setAdding] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/webhooks`);
      const data = await res.json();
      setWebhooks(Array.isArray(data) ? data : []);
    } catch {
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const toggleEvent = (ev: string) => {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const handleAdd = async () => {
    if (!url.trim()) return;
    setAdding(true);
    try {
      await fetch(`${apiUrl}/api/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events: selectedEvents, secret: secret.trim() || undefined }),
      });
      setUrl("");
      setSecret("");
      setSelectedEvents(["alert"]);
      await fetchWebhooks();
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${apiUrl}/api/webhooks/${id}`, { method: "DELETE" });
    await fetchWebhooks();
  };

  const handleTest = async (id: string) => {
    setTestResults((prev) => ({ ...prev, [id]: "…" }));
    try {
      const res = await fetch(`${apiUrl}/api/webhooks/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setTestResults((prev) => ({ ...prev, [id]: `${data.status_code} OK` }));
      } else {
        setTestResults((prev) => ({ ...prev, [id]: data.error ?? `${data.status_code}` }));
      }
    } catch (e) {
      setTestResults((prev) => ({ ...prev, [id]: "Error" }));
    }
  };

  const inputClass =
    "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent h-11";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <CardDescription>
          Receive alert notifications via HTTP webhook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <label className="text-xs text-zinc-500">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.slack.com/..."
                className={inputClass + " w-full"}
              />
            </div>
            <div className="flex flex-col gap-1 w-48">
              <label className="text-xs text-zinc-500">Secret (optional)</label>
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="hmac secret"
                className={inputClass + " w-full"}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs text-zinc-500">Events:</span>
            {ALL_EVENTS.map((ev) => (
              <label key={ev} className="flex items-center gap-1.5 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(ev)}
                  onChange={() => toggleEvent(ev)}
                  className="accent-violet-500"
                />
                {ev}
              </label>
            ))}
            <button
              onClick={handleAdd}
              disabled={adding || !url.trim()}
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors h-11 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Webhook
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 rounded bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No webhooks configured. Add one to receive alerts in Slack, Discord, or any HTTP endpoint.
          </p>
        ) : (
          <div className="rounded-md border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="text-left px-3 py-2 font-medium">URL</th>
                  <th className="text-left px-3 py-2 font-medium">Events</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id} className="border-b border-zinc-800 last:border-0">
                    <td className="px-3 py-2 text-zinc-200 max-w-xs truncate font-mono text-xs">
                      {wh.url}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {wh.events.map((ev) => (
                          <span key={ev} className="text-xs rounded-full px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {testResults[wh.id] && (
                          <span
                            className={
                              testResults[wh.id].includes("OK")
                                ? "text-xs text-emerald-400"
                                : "text-xs text-red-400"
                            }
                          >
                            {testResults[wh.id]}
                          </span>
                        )}
                        <button
                          onClick={() => handleTest(wh.id)}
                          className="text-zinc-500 hover:text-violet-400 transition-colors"
                          title="Send test"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(wh.id)}
                          className="text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete webhook"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, loaded, defaults } = useSettings();
  const { resetLayout } = useLayout();

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-5 h-5 text-violet-400" />
        <h1 className="text-lg sm:text-xl font-semibold">Settings</h1>
      </div>

      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>Configure how the dashboard connects to the backend API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              API URL
            </label>
            <input
              type="url"
              value={settings.apiUrl}
              onChange={(e) => updateSettings({ apiUrl: e.target.value })}
              placeholder={defaults.apiUrl}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent h-11"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Default: {defaults.apiUrl}
            </p>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Refresh interval (seconds)
            </label>
            <input
              type="number"
              min={5}
              max={300}
              value={settings.refreshInterval}
              onChange={(e) =>
                updateSettings({ refreshInterval: Math.max(5, Number(e.target.value) || 30) })
              }
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent h-11"
            />
            <p className="text-xs text-zinc-500 mt-1">
              How often to poll for updates when SSE is unavailable (5–300s).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Display */}
      <Card>
        <CardHeader>
          <CardTitle>Display</CardTitle>
          <CardDescription>Appearance and theme preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Theme
            </label>
            <select
              value={settings.theme}
              onChange={(e) =>
                updateSettings({
                  theme: e.target.value as "light" | "dark" | "system",
                })
              }
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent h-11"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Alert Rules */}
      <AlertRulesSection apiUrl={settings.apiUrl} />

      {/* Webhooks */}
      <WebhooksSection apiUrl={settings.apiUrl} />

      {/* Layout */}
      <Card>
        <CardHeader>
          <CardTitle>Layout</CardTitle>
          <CardDescription>Manage the overview page card order.</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={resetLayout}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors h-11"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Dashboard Layout
          </button>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Reset or clear stored data.</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={resetSettings}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors h-11"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to defaults
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
