"use client";

import { useState, useEffect, useCallback } from "react";
import type { McpDetailResponse, AnalyticsPeriod } from "@glop/shared";

export function useMcpDetail(
  mcpId: string | undefined,
  workspaceId: string | undefined,
  period: AnalyticsPeriod
) {
  const [data, setData] = useState<McpDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!mcpId || !workspaceId) return;
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        period,
      });
      const res = await fetch(`/api/v1/mcps/${mcpId}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [mcpId, workspaceId, period]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
  }, [fetchData]);

  return { data, error, loading, refetch: fetchData };
}
