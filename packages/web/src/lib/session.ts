import { auth } from "../../auth";

export interface SessionWorkspace {
  id: string;
  role: "admin" | "member";
}

export interface SessionUser {
  user_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  workspaces: SessionWorkspace[];
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    user_id: session.user.id,
    email: session.user.email || "",
    name: session.user.name || null,
    avatar_url: session.user.image || null,
    workspaces:
      ((session as unknown as Record<string, unknown>).workspaces as SessionWorkspace[]) ||
      [],
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    throw new AuthError("Authentication required");
  }
  return session;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
