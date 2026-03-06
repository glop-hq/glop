"use client";

import { useState, useEffect, useCallback } from "react";
import type { InviteLinkResponse } from "@glop/shared";

export function useInviteLink(workspaceId: string) {
  const [inviteLink, setInviteLink] = useState<InviteLinkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLink = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/invite-link`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setInviteLink(json.invite_link || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch invite link");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchLink();
  }, [fetchLink]);

  const createLink = async (role: "admin" | "member" = "member") => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/invite-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const json = await res.json();
    setInviteLink(json.invite_link);
    return json.invite_link as InviteLinkResponse;
  };

  const disableLink = async () => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/invite-link`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    setInviteLink(null);
  };

  return {
    inviteLink,
    loading,
    error,
    fetchLink,
    createLink,
    disableLink,
  };
}
