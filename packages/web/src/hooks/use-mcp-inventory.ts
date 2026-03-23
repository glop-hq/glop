"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  McpServer,
  McpComplianceSummary,
  McpStatus,
  AnalyticsPeriod,
} from "@glop/shared";

interface McpInventoryData {
  mcps: McpServer[];
  compliance: McpComplianceSummary;
}

export function useMcpInventory(
  workspaceId: string | undefined,
  period: AnalyticsPeriod,
  statusFilter?: McpStatus
) {
  const [data, setData] = useState<McpInventoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        period,
      });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/v1/mcps?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, period, statusFilter]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
  }, [fetchData]);

  return { data, error, loading, refetch: fetchData };
}
