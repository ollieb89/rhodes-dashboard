"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Github, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ErrorBoundary } from "@/components/error-boundary";

interface MonitoredRepo {
  repo_full_name: string;
  added_at: string;
}

export default function SettingsPage() {
  const [repos, setRepos] = useState<MonitoredRepo[]>([]);
  const [newRepo, setNewRepo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/settings/repos");
      const data = await res.json();
      setRepos(data.repos || []);
    } catch (err) {
      console.error("Failed to load repos", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, []);

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepo.includes("/") || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/settings/repos", {
        method: "POST",
        body: JSON.stringify({ repo_full_name: newRepo.trim() }),
      });
      if (res.ok) {
        setNewRepo("");
        loadRepos();
      } else {
        setError("Failed to add repository.");
      }
    } catch (err) {
      setError("Failed to add repository.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRepo = async (fullName: string) => {
    try {
      const [owner, repo] = fullName.split("/");
      const res = await apiFetch(`/api/settings/repos/${owner}/${repo}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadRepos();
      }
    } catch (err) {
      console.error("Failed to remove repo", err);
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
            <p className="text-sm text-zinc-500 mt-1">Configure dashboard data sources and preferences.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Github className="w-4 h-4" />
                Monitored Repositories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddRepo} className="flex gap-2">
                <input
                  placeholder="owner/repo (e.g. ollieb89/rhodes-dashboard)"
                  value={newRepo}
                  onChange={(e) => setNewRepo(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button 
                  type="submit" 
                  disabled={submitting || !newRepo.includes("/")}
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 h-9"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </form>
              
              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-zinc-700" />
                  </div>
                ) : repos.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg">
                    <p className="text-sm text-zinc-600">No custom repositories configured.</p>
                    <p className="text-[10px] text-zinc-700 mt-1">Defaulting to all repos for ollieb89.</p>
                  </div>
                ) : (
                  repos.map((repo) => (
                    <div 
                      key={repo.repo_full_name} 
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <Github className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-200">{repo.repo_full_name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRepo(repo.repo_full_name)}
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-400/10 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}
