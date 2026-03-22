"use client";

import { useState, useEffect, useCallback } from "react";
import type { RepoInsight } from "@glop/shared";

export function useRepoInsights(workspaceId: string, repoId: string) {
  const [insight, setInsight] = useState<RepoInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = useCallback(async () => {
    if (!workspaceId || !repoId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/v1/repos/insights?workspace_id=${workspaceId}&repo_id=${repoId}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setInsight(json.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch insights"
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId, repoId]);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  return { insight, loading, error, refetch: fetchInsight };
}
