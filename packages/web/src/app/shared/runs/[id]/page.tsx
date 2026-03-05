"use client";

import { use } from "react";
import { useSharedRun } from "@/hooks/use-shared-run";
import { SharedRunView } from "@/components/shared-run-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, AlertTriangle } from "lucide-react";

export default function SharedRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, loading } = useSharedRun(id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-green-50">
          <div className="mx-auto flex h-10 max-w-5xl items-center px-4 sm:px-6">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Link2 className="h-4 w-4" />
              <span className="font-medium">Shared view</span>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-5xl p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <AlertTriangle className="h-8 w-8" />
        <p className="text-sm">{error || "Run not found"}</p>
      </div>
    );
  }

  return <SharedRunView data={data} />;
}
