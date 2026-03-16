"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useInviteLink } from "@/hooks/use-invite-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Trash2, Shield, ShieldCheck, Loader2, Link2, Copy, Check, X, Send, Settings, Github } from "lucide-react";
import type { SessionWorkspace } from "@/lib/session";

export default function WorkspaceSettingsPage() {
  const { data: session } = useSession();
  const { currentWorkspace: workspaceDetail, refetch: refetchWorkspaces } = useWorkspaces();

  // Get workspace auth info (id + role) from session
  const sessionWorkspaces = (
    (session as unknown as Record<string, unknown>)?.workspaces as SessionWorkspace[]
  ) || [];
  const workspace = sessionWorkspaces.find((w) => w.id === workspaceDetail?.id) || sessionWorkspaces[0];

  if (!workspace) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground">No workspace found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Workspace Settings</h1>
        <p className="max-w-md truncate text-sm text-muted-foreground mt-1" title={workspaceDetail?.name}>{workspaceDetail?.name}</p>
      </div>
      {workspace.role === "admin" && (
        <GeneralSection
          workspaceId={workspace.id}
          workspaceName={workspaceDetail?.name || ""}
          onSaved={refetchWorkspaces}
        />
      )}
      <MembersSection workspaceId={workspace.id} isAdmin={workspace.role === "admin"} currentUserId={session?.user?.id} />
      {workspace.role === "admin" && (
        <InviteLinkSection workspaceId={workspace.id} />
      )}
      {workspace.role === "admin" && (
        <GitHubSection workspaceId={workspace.id} />
      )}
    </main>
  );
}

function GeneralSection({
  workspaceId,
  workspaceName,
  onSaved,
}: {
  workspaceId: string;
  workspaceName: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(workspaceName);
  useEffect(() => { setName(workspaceName); }, [workspaceName]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty = name.trim() !== workspaceName;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !isDirty) return;

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="h-4 w-4" />
          General
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">
              Workspace name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              required
              maxLength={100}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="cursor-pointer"
            disabled={saving || !isDirty || !name.trim()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              "Save"
            )}
          </Button>
        </form>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </CardContent>
    </Card>
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
  const { members, invitations, loading, error, inviteMember, updateMemberRole, removeMember, cancelInvitation, resendInvitation } =
    useWorkspaceMembers(workspaceId);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      await inviteMember(inviteEmail.trim(), inviteRole);
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`);
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

  const handleCancelInvitation = async (invitationId: string) => {
    setActionLoading(invitationId);
    try {
      await cancelInvitation(invitationId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel invitation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setActionLoading(`resend-${invitationId}`);
    try {
      await resendInvitation(invitationId);
      setInviteSuccess("Invitation email resent");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resend invitation");
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

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Pending Invitations</p>
            <div className="divide-y">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {invitation.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited by {invitation.inviter?.name || invitation.inviter?.email || "unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Pending
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">{invitation.role}</span>
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Resend email"
                          className="cursor-pointer h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          disabled={actionLoading === `resend-${invitation.id}`}
                          onClick={() => handleResendInvitation(invitation.id)}
                        >
                          {actionLoading === `resend-${invitation.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Cancel invitation"
                          className="cursor-pointer h-7 w-7 p-0 text-destructive hover:text-destructive"
                          disabled={actionLoading === invitation.id}
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          {actionLoading === invitation.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
        {inviteSuccess && (
          <p className="text-xs text-green-600">{inviteSuccess}</p>
        )}
      </CardContent>
    </Card>
  );
}

function GitHubSection({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<{
    configured: boolean;
    connected: boolean;
    installation: { github_account_login: string; github_account_type: string; created_at: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/github`);
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Clean up ?github= query param from callback redirect
    const url = new URL(window.location.href);
    if (url.searchParams.has("github")) {
      url.searchParams.delete("github");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleDisconnect = async () => {
    if (!confirm("Disconnect GitHub integration? Glop will stop posting comments on PRs.")) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/github`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!status?.configured) {
    return null;
  }

  const appSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Github className="h-4 w-4" />
          GitHub Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.connected && status.installation ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm">
                Connected to <span className="font-medium">{status.installation.github_account_login}</span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer text-xs text-destructive hover:text-destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Install the Glop GitHub App to automatically post session context as comments on pull requests created during Glop runs.
            </p>
            {appSlug ? (
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  window.location.href = `https://github.com/apps/${appSlug}/installations/new`;
                }}
              >
                <Github className="h-4 w-4 mr-1" />
                Install GitHub App
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                GitHub App is not fully configured. Contact your administrator.
              </p>
            )}
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function InviteLinkSection({ workspaceId }: { workspaceId: string }) {
  const { inviteLink, loading, createLink, disableLink } = useInviteLink(workspaceId);
  const [creating, setCreating] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkRole, setLinkRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      await createLink(linkRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    setError(null);
    try {
      await disableLink();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable link");
    } finally {
      setDisabling(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink?.url) return;
    await navigator.clipboard.writeText(inviteLink.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Invite Link</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Invite Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {inviteLink ? (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink.url}
                className="flex-1 rounded-md border bg-muted px-3 py-1.5 text-sm font-mono text-muted-foreground"
              />
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Anyone with this link can join as <span className="font-medium">{inviteLink.role}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer text-xs"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer text-xs text-destructive hover:text-destructive"
                  onClick={handleDisable}
                  disabled={disabling}
                >
                  {disabling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Disable
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={linkRole}
              onChange={(e) => setLinkRole(e.target.value as "admin" | "member")}
              className="cursor-pointer rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Link2 className="h-4 w-4 mr-1" />
              )}
              Generate Invite Link
            </Button>
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
