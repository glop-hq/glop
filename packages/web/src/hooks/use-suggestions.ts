"use client";

import { useState, useEffect, useCallback } from "react";
import type { StandardSuggestion, SuggestionsSummary } from "@glop/shared";

export function useSuggestions(repoId: string) {
  const [suggestions, setSuggestions] = useState<StandardSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!repoId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/v1/repos/${repoId}/suggestions?status=active`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSuggestions(json.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch suggestions"
      );
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return { suggestions, loading, error, refetch: fetchSuggestions };
}

export function useSuggestionsSummary(workspaceId: string | undefined) {
  const [data, setData] = useState<SuggestionsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/v1/dashboard/suggestions?workspace_id=${workspaceId}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch suggestions"
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
