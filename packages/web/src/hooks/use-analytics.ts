"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalyticsResponse, AnalyticsPeriod } from "@glop/shared";

export function useAnalytics(
  workspaceId: string | undefined,
  period: AnalyticsPeriod,
  developerId?: string
) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        period,
      });
      if (developerId) {
        params.set("user_id", developerId);
      }
      const res = await fetch(`/api/v1/analytics?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, period, developerId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
  }, [fetchData]);

  return { data, error, loading };
}
