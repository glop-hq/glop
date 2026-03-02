"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Share2, Users, Link2, Lock, Copy, Check, Loader2 } from "lucide-react";
import type { Run, RunVisibility } from "@glop/shared";

interface ShareDialogProps {
  run: Run;
  onVisibilityChange?: (visibility: RunVisibility) => void;
}

export function ShareDialog({ run, onVisibilityChange }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(run.shared_link_expires_at);
  const [copied, setCopied] = useState(false);
  const [visibility, setVisibility] = useState<RunVisibility>(run.visibility);
  const [error, setError] = useState<string | null>(null);

  const updateShare = useCallback(
    async (newVisibility: RunVisibility, expiresInDays?: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/runs/${run.id}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visibility: newVisibility,
            ...(expiresInDays ? { expires_in_days: expiresInDays } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setVisibility(data.visibility);
        if (data.shared_link_url) setSharedUrl(data.shared_link_url);
        if (data.expires_at) setExpiresAt(data.expires_at);
        onVisibilityChange?.(data.visibility);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update sharing");
      } finally {
        setLoading(false);
      }
    },
    [run.id, onVisibilityChange]
  );

  const revokeShare = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/runs/${run.id}/share`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setVisibility("private");
      setSharedUrl(null);
      setExpiresAt(null);
      onVisibilityChange?.("private");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setLoading(false);
    }
  }, [run.id, onVisibilityChange]);

  const copyUrl = useCallback(() => {
    if (sharedUrl) {
      navigator.clipboard.writeText(sharedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [sharedUrl]);

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
      <div className="w-72 p-3 space-y-3">
        <h3 className="text-sm font-semibold">Share this run</h3>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {visibility === "private" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              This run is only visible to you.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full cursor-pointer justify-start"
              disabled={loading}
              onClick={() => updateShare("workspace")}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Share with team
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full cursor-pointer justify-start"
              disabled={loading}
              onClick={() => updateShare("shared_link")}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Share via link
            </Button>
          </div>
        )}

        {visibility === "workspace" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Users className="h-3.5 w-3.5" />
              Shared with team
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full cursor-pointer justify-start"
              disabled={loading}
              onClick={() => updateShare("shared_link")}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Create share link
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full cursor-pointer justify-start text-muted-foreground"
              disabled={loading}
              onClick={() => updateShare("private")}
            >
              <Lock className="h-4 w-4 mr-2" />
              Make private
            </Button>
          </div>
        )}

        {visibility === "shared_link" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-green-600">
              <Link2 className="h-3.5 w-3.5" />
              Shared via link
            </div>

            {sharedUrl && (
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

            {expiresAt && (
              <p className="text-xs text-muted-foreground">
                Expires {new Date(expiresAt).toLocaleDateString()}
              </p>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="w-full cursor-pointer justify-start text-destructive"
              disabled={loading}
              onClick={revokeShare}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Revoke link
            </Button>
          </div>
        )}
      </div>
    </Popover>
  );
}
