export type MemberRole = "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string;
  provider_account_id: string;
  created_at: string;
  updated_at: string;
}
