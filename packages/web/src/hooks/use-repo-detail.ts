"use client";

import { useState, useEffect, useCallback } from "react";
import type { Repo, RepoScanCheck } from "@glop/shared";

interface RepoDetailData {
  repo: Repo;
  run_count: number;
  latest_scan: {
    id: string;
    score: number | null;
    status: string;
    completed_at: string | null;
    checks: RepoScanCheck[];
  } | null;
  scan_history: {
    id: string;
    score: number | null;
    status: string;
    completed_at: string | null;
    created_at: string;
  }[];
  recent_runs: {
    id: string;
    developer_id: string;
    git_user_name: string | null;
    status: string;
    title: string | null;
    started_at: string;
    completed_at: string | null;
    event_count: number;
    file_count: number;
  }[];
}

export function useRepoDetail(repoId: string) {
  const [data, setData] = useState<RepoDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/repos/${repoId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch repo");
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch: fetchDetail };
}
