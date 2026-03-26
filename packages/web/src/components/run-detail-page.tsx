"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { RunDetailView } from "@/components/run-detail-view";
import { NavHeader } from "@/components/nav-header";
import { RunSignIn } from "@/components/run-sign-in";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldX, Check, Loader2 } from "lucide-react";

type AccessState = "loading" | "granted" | "unauthenticated" | "forbidden";

export type RunPreview = {
  title: string | null;
  started_at: string | null;
  status: string | null;
};

export function RunDetailPage({ runId }: { runId: string }) {
  const { status: sessionStatus } = useSession();
  const [access, setAccess] = useState<AccessState>("loading");
  const [preview, setPreview] = useState<RunPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      try {
        const res = await fetch(`/api/v1/runs/${runId}`);
        if (cancelled) return;
        if (res.ok) {
          setAccess("granted");
        } else if (res.status === 401) {
          try {
            const body = await res.json();
            if (body.preview) setPreview(body.preview);
          } catch { /* ignore parse errors */ }
          setAccess("unauthenticated");
        } else if (res.status === 403) {
          setAccess("forbidden");
        } else {
          setAccess("granted"); // let RunDetailView handle other errors
        }
      } catch {
        if (!cancelled) setAccess("granted"); // let RunDetailView handle
      }
    }
    checkAccess();
    return () => { cancelled = true; };
  }, [runId]);

  const isAuthenticated = sessionStatus === "authenticated";

  if (access === "loading") {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (access === "unauthenticated") {
    return <RunSignIn runId={runId} preview={preview} />;
  }

  if (access === "forbidden") {
    return <ForbiddenScreen runId={runId} />;
  }

  return (
    <div className="min-h-screen">
      {isAuthenticated && <NavHeader />}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <RunDetailView runId={runId} />
      </main>
    </div>
  );
}

function ForbiddenScreen({ runId }: { runId: string }) {
  const [requestState, setRequestState] = useState<
    "idle" | "loading" | "sent"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    async function checkExisting() {
      try {
        const res = await fetch(`/api/v1/runs/${runId}/request-access`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setRequestState(data.requested ? "sent" : "idle");
        } else {
          setRequestState("idle");
        }
      } catch {
        if (!cancelled) setRequestState("idle");
      }
    }
    checkExisting();
    return () => { cancelled = true; };
  }, [runId]);

  async function handleRequestAccess() {
    setRequestState("loading");
    try {
      const res = await fetch(`/api/v1/runs/${runId}/request-access`, {
        method: "POST",
      });
      if (res.ok || res.status === 200) {
        setRequestState("sent");
      } else {
        setRequestState("idle");
      }
    } catch {
      setRequestState("idle");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <ShieldX className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            No access to this session
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view this session. Request access
            and the owner will be notified.
          </p>
        </div>
        {requestState === "sent" ? (
          <button
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground opacity-80"
          >
            <Check className="h-4 w-4" />
            Request sent
          </button>
        ) : (
          <button
            onClick={handleRequestAccess}
            disabled={requestState === "loading"}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {requestState === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Request access
          </button>
        )}
        <a
          href="/sessions"
          className="mt-3 flex w-full cursor-pointer items-center justify-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Go to sessions
        </a>
      </div>
    </div>
  );
}
