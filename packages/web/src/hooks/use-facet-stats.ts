"use client";

import { useState, useEffect, useCallback } from "react";

export interface FacetStats {
  total_facets: number;
  recent_facets: number;
  recent_developers: number;
  recent_repos: number;
  outcome_distribution: Record<string, number>;
  friction_distribution: Record<string, number>;
  top_friction_repos: Array<{
    repo_id: string;
    repo_key: string;
    friction_count: number;
  }>;
}

export function useFacetStats(workspaceId: string) {
  const [stats, setStats] = useState<FacetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/v1/facets/summary?workspace_id=${workspaceId}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setStats(json.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch facet stats"
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
