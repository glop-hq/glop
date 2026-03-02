"use client";

import { useState, useEffect, useCallback } from "react";
import type { MemberResponse, InvitationResponse } from "@glop/shared";

export function useWorkspaceMembers(workspaceId: string) {
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setMembers(json.members);
      setInvitations(json.invitations || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch members");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const inviteMember = async (email: string, role: "admin" | "member" = "member") => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    await fetchMembers();
    return res.json();
  };

  const updateMemberRole = async (memberId: string, role: "admin" | "member") => {
    const res = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    await fetchMembers();
  };

  const removeMember = async (memberId: string) => {
    const res = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    await fetchMembers();
  };

  const cancelInvitation = async (invitationId: string) => {
    const res = await fetch(
      `/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    await fetchMembers();
  };

  const resendInvitation = async (invitationId: string) => {
    const res = await fetch(
      `/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`,
      { method: "POST" }
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }
  };

  return {
    members,
    invitations,
    loading,
    error,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvitation,
    resendInvitation,
    refetch: fetchMembers,
  };
}
