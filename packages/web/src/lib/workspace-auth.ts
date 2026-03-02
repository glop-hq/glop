import type { SessionUser, SessionWorkspace } from "./session";

export class WorkspaceAuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "WorkspaceAuthError";
    this.status = status;
  }
}

export function getWorkspaceMembership(
  session: SessionUser,
  workspaceId: string
): SessionWorkspace | null {
  return session.workspaces.find((w) => w.id === workspaceId) || null;
}

export function isWorkspaceAdmin(
  session: SessionUser,
  workspaceId: string
): boolean {
  const membership = getWorkspaceMembership(session, workspaceId);
  return membership?.role === "admin";
}

export function requireWorkspaceMember(
  session: SessionUser,
  workspaceId: string
): SessionWorkspace {
  const membership = getWorkspaceMembership(session, workspaceId);
  if (!membership) {
    throw new WorkspaceAuthError("Not a member of this workspace");
  }
  return membership;
}
