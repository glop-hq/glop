"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { RunDetailView } from "@/components/run-detail-view";
import { NavHeader } from "@/components/nav-header";
import { RunSignIn } from "@/components/run-sign-in";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldX } from "lucide-react";

type AccessState = "loading" | "granted" | "unauthenticated" | "forbidden";

export function RunDetailPage({ runId }: { runId: string }) {
  const { status: sessionStatus } = useSession();
  const [access, setAccess] = useState<AccessState>("loading");

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      try {
        const res = await fetch(`/api/v1/runs/${runId}`, { method: "HEAD" });
        if (cancelled) return;
        if (res.ok) setAccess("granted");
        else if (res.status === 401) setAccess("unauthenticated");
        else if (res.status === 403) setAccess("forbidden");
        else setAccess("granted"); // let RunDetailView handle other errors
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
    return <RunSignIn runId={runId} />;
  }

  if (access === "forbidden") {
    return (
      <div className="min-h-screen">
        <NavHeader />
        <div className="flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground">
          <ShieldX className="h-8 w-8" />
          <p className="text-sm">You don&apos;t have access to this session.</p>
        </div>
      </div>
    );
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
