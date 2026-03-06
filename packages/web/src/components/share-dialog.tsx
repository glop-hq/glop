"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Share2, Users, Link2, Copy, Check, Loader2, XCircle } from "lucide-react";
import type { Run, ShareRunResponse } from "@glop/shared";

interface ShareDialogProps {
  run: Run;
  sharedLinkActive: boolean;
  onShareChange?: (resp: ShareRunResponse) => void;
}

type ShareAction = "share_workspace" | "unshare_workspace" | "create_link" | "revoke_link";

export function ShareDialog({ run, sharedLinkActive, onShareChange }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ShareAction | null>(null);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callShare = useCallback(
    async (action: ShareAction, expiresInDays?: number) => {
      setLoading(action);
      setError(null);
      try {
        const res = await fetch(`/api/v1/runs/${run.id}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(expiresInDays ? { expires_in_days: expiresInDays } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const data: ShareRunResponse = await res.json();
        if (data.shared_link_url) setSharedUrl(data.shared_link_url);
        if (!data.shared_link_active) setSharedUrl(null);
        onShareChange?.(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update sharing");
      } finally {
        setLoading(null);
      }
    },
    [run.id, onShareChange]
  );

  const copyUrl = useCallback(() => {
    if (sharedUrl) {
      navigator.clipboard.writeText(sharedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [sharedUrl]);

  const isWorkspaceShared = run.visibility === "workspace";

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          <Share2 className="h-4 w-4 mr-1" />
          Share
        </Button>
      }
    >
      <div className="w-72 p-3 space-y-4">
        <h3 className="text-sm font-semibold">Share this run</h3>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {/* Workspace sharing section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-4 w-4" />
              Share with team
            </div>
            {isWorkspaceShared ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 cursor-pointer text-xs text-muted-foreground"
                disabled={loading !== null}
                onClick={() => callShare("unshare_workspace")}
              >
                {loading === "unshare_workspace" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Remove"
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 cursor-pointer text-xs"
                disabled={loading !== null}
                onClick={() => callShare("share_workspace")}
              >
                {loading === "share_workspace" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Enable"
                )}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isWorkspaceShared
              ? "Visible to all workspace members."
              : "Only visible to you."}
          </p>
        </div>

        <hr className="border-border" />

        {/* Link sharing section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Link2 className="h-4 w-4" />
              Share via link
            </div>
            {sharedLinkActive ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 cursor-pointer text-xs text-destructive"
                disabled={loading !== null}
                onClick={() => callShare("revoke_link")}
              >
                {loading === "revoke_link" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Revoke
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 cursor-pointer text-xs"
                disabled={loading !== null}
                onClick={() => callShare("create_link")}
              >
                {loading === "create_link" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Create link"
                )}
              </Button>
            )}
          </div>

          {sharedLinkActive && sharedUrl && (
            <div className="flex gap-1">
              <input
                type="text"
                readOnly
                value={sharedUrl}
                className="flex-1 rounded-md border px-2 py-1 text-xs font-mono bg-muted truncate"
              />
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer shrink-0"
                onClick={copyUrl}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}

          {sharedLinkActive && run.shared_link_expires_at && (
            <p className="text-xs text-muted-foreground">
              Expires {new Date(run.shared_link_expires_at).toLocaleDateString()}
            </p>
          )}

          {!sharedLinkActive && (
            <p className="text-xs text-muted-foreground">
              Anyone with the link can view this run.
            </p>
          )}
        </div>
      </div>
    </Popover>
  );
}
