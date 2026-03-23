"use client";

import { useState, useEffect, useCallback } from "react";
import type { PermissionRecommendationsResponse } from "@glop/shared";

export function useRepoPermissions(
  workspaceId: string | undefined,
  repoId: string | undefined
) {
  const [data, setData] = useState<PermissionRecommendationsResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!workspaceId || !repoId) return;
    try {
      const res = await fetch(`/api/v1/repos/${repoId}/permissions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, repoId]);

  const analyze = useCallback(async () => {
    if (!repoId) return;
    try {
      await fetch(`/api/v1/repos/${repoId}/permissions/analyze`, {
        method: "POST",
      });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    }
  }, [repoId, fetchData]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
  }, [fetchData]);

  return { data, error, loading, analyze };
}
