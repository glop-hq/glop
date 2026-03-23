"use client";

import { useState, useEffect, useCallback } from "react";
import type { StandardsUsageResponse, AnalyticsPeriod } from "@glop/shared";

export function useStandardsUsage(
  workspaceId: string | undefined,
  period: AnalyticsPeriod
) {
  const [data, setData] = useState<StandardsUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        period,
      });
      const res = await fetch(`/api/v1/dashboard/standards-usage?${params}`);
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
