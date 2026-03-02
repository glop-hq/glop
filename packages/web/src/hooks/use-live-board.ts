"use client";

import { useState, useEffect, useCallback } from "react";
import { LIVE_POLL_INTERVAL_MS, type LiveBoardResponse } from "@glop/shared";

export function useLiveBoard(workspaceId: string | undefined) {
  const [data, setData] = useState<LiveBoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/v1/live?workspace_id=${workspaceId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
    const interval = setInterval(fetchData, LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, error, loading };
}
