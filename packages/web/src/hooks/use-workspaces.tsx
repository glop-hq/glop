"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { WorkspaceResponse } from "@glop/shared";

interface WorkspacesContextValue {
  workspaces: WorkspaceResponse[];
  loading: boolean;
  refetch: () => Promise<void>;
}

const WorkspacesContext = createContext<WorkspacesContextValue>({
  workspaces: [],
  loading: true,
  refetch: async () => {},
});

export function WorkspacesProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/workspaces");
      if (!res.ok) return;
      const json = await res.json();
      setWorkspaces(json.workspaces);
    } catch {
      // silent — auth might not be ready yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <WorkspacesContext.Provider value={{ workspaces, loading, refetch: fetchWorkspaces }}>
      {children}
    </WorkspacesContext.Provider>
  );
}

export function useWorkspaces() {
  return useContext(WorkspacesContext);
}
