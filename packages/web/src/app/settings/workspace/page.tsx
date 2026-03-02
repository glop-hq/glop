"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Trash2, Shield, ShieldCheck, Loader2 } from "lucide-react";
import type { SessionWorkspace } from "@/lib/session";

export default function WorkspaceSettingsPage() {
  const { data: session } = useSession();

  // Get workspaces from the session token
  const workspaces = (
    (session as unknown as Record<string, unknown>)?.workspaces as SessionWorkspace[]
  ) || [];
  const workspace = workspaces[0];

  if (!workspace) {
    return (
      <div className="min-h-screen bg-background">
        <NavHeader />
        <main className="mx-auto max-w-3xl p-6">
          <p className="text-muted-foreground">No workspace found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader />
      <main className="mx-auto max-w-3xl p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Workspace Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">{workspace.name}</p>
        </div>
        <MembersSection workspaceId={workspace.id} isAdmin={workspace.role === "admin"} currentUserId={session?.user?.id} />
      </main>
    </div>
  );
}

function MembersSection({
  workspaceId,
  isAdmin,
  currentUserId,
}: {
  workspaceId: string;
  isAdmin: boolean;
  currentUserId?: string;
}) {
  const { members, loading, error, inviteMember, updateMemberRole, removeMember } =
    useWorkspaceMembers(workspaceId);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteError(null);
    try {
      await inviteMember(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      setInviteRole("member");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: "admin" | "member") => {
    setActionLoading(memberId);
    try {
      await updateMemberRole(memberId, role);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Remove this member?")) return;
    setActionLoading(memberId);
    try {
      await removeMember(memberId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground text-sm">
          Failed to load members: {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Members ({members.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Member list */}
        <div className="divide-y">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                  {(member.user?.name || member.user?.email || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {member.user?.name || member.user?.email}
                    {member.user_id === currentUserId && (
                      <span className="text-muted-foreground ml-1">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {member.role === "admin" ? (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    Member
                  </span>
                )}
                {isAdmin && member.user_id !== currentUserId && (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value as "admin" | "member")
                      }
                      disabled={actionLoading === member.id}
                      className="cursor-pointer rounded border px-1.5 py-0.5 text-xs"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-7 w-7 p-0 text-destructive hover:text-destructive"
                      disabled={actionLoading === member.id}
                      onClick={() => handleRemove(member.id)}
                    >
                      {actionLoading === member.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Invite form - admin only */}
        {isAdmin && (
          <form onSubmit={handleInvite} className="flex items-end gap-2 pt-2 border-t">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">
                Invite by email
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
                required
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
              className="cursor-pointer rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit" size="sm" className="cursor-pointer" disabled={inviting}>
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1" />
              )}
              Invite
            </Button>
          </form>
        )}
        {inviteError && (
          <p className="text-xs text-destructive">{inviteError}</p>
        )}
      </CardContent>
    </Card>
  );
}
