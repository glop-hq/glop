"use client";

import { useLiveBoard } from "@/hooks/use-live-board";
import { RunRow } from "./run-row";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio } from "lucide-react";

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export function LiveBoard() {
  const { data, error, loading } = useLiveBoard();

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <p>Failed to load: {error}</p>
      </div>
    );
  }

  if (!data || data.runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
        <Radio className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm">No active runs</p>
        <p className="text-xs mt-1">
          Runs will appear here when developers use Claude with glop hooks
          installed
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Developer
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Repo / Branch
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Phase
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Last Action
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Last Update
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Links
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {data.runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              artifacts={run.artifacts}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
