"use client";

import { useState, useEffect, useCallback } from "react";
import type { CoachingTip, CoachingTipsSummary } from "@glop/shared";

export function useCoachingTips(workspaceId: string | undefined) {
  const [data, setData] = useState<CoachingTipsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/v1/coaching/tips?workspace_id=${workspaceId}&channel=dashboard`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: CoachingTip[] };
      const tips = json.data;

      // Compute summary
      const by_source: Record<string, number> = {};
      for (const tip of tips) {
        by_source[tip.source_type] = (by_source[tip.source_type] ?? 0) + 1;
      }

      setData({
        total_active: tips.length,
        by_source,
        top_tips: tips.slice(0, 3),
      });
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch coaching tips"
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

export function useDismissTip() {
  const [dismissing, setDismissing] = useState<string | null>(null);

  const dismiss = useCallback(
    async (tipId: string, reason?: string) => {
      setDismissing(tipId);
      try {
        const body: Record<string, string> = { status: "dismissed" };
        if (reason) body.dismiss_reason = reason;

        const res = await fetch(`/api/v1/coaching/tips/${tipId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        setDismissing(null);
      }
    },
    []
  );

  return { dismiss, dismissing };
}
