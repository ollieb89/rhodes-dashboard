"use client";

import { useSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, RotateCcw } from "lucide-react";

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, loaded, defaults } = useSettings();

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
