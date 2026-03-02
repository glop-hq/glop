"use client";

import { useState, useEffect } from "react";
import type { SharedRunDetailResponse } from "@glop/shared";

export function useSharedRun(runId: string, token: string) {
  const [data, setData] = useState<SharedRunDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSharedRun() {
      try {
        const res = await fetch(
          `/api/v1/shared/runs/${runId}?token=${encodeURIComponent(token)}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch shared run");
      } finally {
        setLoading(false);
      }
    }

    fetchSharedRun();
  }, [runId, token]);

  return { data, error, loading };
}
