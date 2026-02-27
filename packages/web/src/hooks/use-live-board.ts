"use client";

import { useState, useEffect, useCallback } from "react";
import { LIVE_POLL_INTERVAL_MS, type LiveBoardResponse } from "@glop/shared";

export function useLiveBoard() {
  const [data, setData] = useState<LiveBoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/live");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, error, loading };
}
