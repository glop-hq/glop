"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { WorkspaceResponse } from "@glop/shared";

const STORAGE_KEY = "glop_current_workspace_id";

interface WorkspacesContextValue {
  workspaces: WorkspaceResponse[];
  currentWorkspace: WorkspaceResponse | undefined;
  setCurrentWorkspace: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const WorkspacesContext = createContext<WorkspacesContextValue>({
  workspaces: [],
  currentWorkspace: undefined,
  setCurrentWorkspace: () => {},
  loading: true,
  refetch: async () => {},
});

export function WorkspacesProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

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

  const currentWorkspace =
    workspaces.find((w) => w.id === currentId) || workspaces[0];

  const setCurrentWorkspace = useCallback((id: string) => {
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return (
    <WorkspacesContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        loading,
        refetch: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspacesContext.Provider>
  );
}

export function useWorkspaces() {
  return useContext(WorkspacesContext);
}
