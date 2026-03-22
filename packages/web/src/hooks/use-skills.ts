"use client";

import { useState, useEffect, useCallback } from "react";
import type { ClaudeItemWithRepo } from "@glop/shared";

export function useSkills(
  workspaceId: string,
  filters?: { kind?: string; search?: string }
) {
  const [items, setItems] = useState<ClaudeItemWithRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ workspace_id: workspaceId });
      if (filters?.kind) params.set("kind", filters.kind);
      if (filters?.search) params.set("search", filters.search);

      const res = await fetch(`/api/v1/skills?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch skills");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filters?.kind, filters?.search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, loading, error, refetch: fetchItems };
}
