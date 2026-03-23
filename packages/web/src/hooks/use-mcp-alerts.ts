"use client";

import { useState, useEffect, useCallback } from "react";
import type { McpAlert } from "@glop/shared";

export function useMcpAlerts(
  workspaceId: string | undefined,
  acknowledged?: boolean
) {
  const [data, setData] = useState<McpAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId });
      if (acknowledged !== undefined)
        params.set("acknowledged", String(acknowledged));
      const res = await fetch(`/api/v1/mcps/alerts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.alerts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, acknowledged]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
  }, [fetchData]);

  return { data, error, loading, refetch: fetchData };
}
