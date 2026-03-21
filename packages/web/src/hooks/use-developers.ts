"use client";

import { useState, useEffect, useCallback } from "react";
import type { DeveloperWithStats } from "@glop/shared";

export function useDevelopers(workspaceId: string) {
  const [developers, setDevelopers] = useState<DeveloperWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevelopers = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/developers?workspace_id=${workspaceId}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDevelopers(json.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch developers"
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchDevelopers();
  }, [fetchDevelopers]);

  const updateDeveloper = async (
    developerId: string,
    data: { display_name?: string; email?: string }
  ) => {
    const res = await fetch(`/api/v1/developers/${developerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    await fetchDevelopers();
  };

  const mergeDevelopers = async (sourceId: string, targetId: string) => {
    const res = await fetch("/api/v1/developers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    await fetchDevelopers();
  };

  return {
    developers,
    loading,
    error,
    updateDeveloper,
    mergeDevelopers,
    refetch: fetchDevelopers,
  };
}
