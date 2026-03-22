"use client";

import { useState, useEffect, useCallback } from "react";
import type { RepoDashboardResponse, AnalyticsPeriod } from "@glop/shared";

export function useRepoDashboard(
  workspaceId: string | undefined,
  repoId: string,
  period: AnalyticsPeriod
) {
  const [data, setData] = useState<RepoDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        period,
      });
      const res = await fetch(`/api/v1/dashboard/repos/${repoId}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, repoId, period]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
  }, [fetchData]);

  return { data, error, loading };
}
