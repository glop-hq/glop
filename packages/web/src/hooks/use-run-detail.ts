"use client";

import { useState, useEffect, useCallback } from "react";
import { DETAIL_POLL_INTERVAL_MS, type RunDetailResponse } from "@glop/shared";

export function useRunDetail(runId: string) {
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/runs/${runId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, DETAIL_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, error, loading };
}
