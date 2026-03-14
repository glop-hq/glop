"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalyticsResponse, AnalyticsPeriod } from "@glop/shared";

export function useAnalytics(
  workspaceId: string | undefined,
  period: AnalyticsPeriod
) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(
        `/api/v1/analytics?workspace_id=${workspaceId}&period=${period}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, period]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
  }, [fetchData]);

  return { data, error, loading };
}
