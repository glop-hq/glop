"use client";

import { useState, useEffect, useCallback } from "react";
import type { RepoWithScanStats } from "@glop/shared";

export function useRepos(workspaceId: string) {
  const [repos, setRepos] = useState<RepoWithScanStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/repos?workspace_id=${workspaceId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRepos(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch repos");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const updateRepo = async (
    repoId: string,
    data: { display_name?: string; description?: string }
  ) => {
    const res = await fetch(`/api/v1/repos/${repoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    await fetchRepos();
  };

  return {
    repos,
    loading,
    error,
    updateRepo,
    refetch: fetchRepos,
  };
}
