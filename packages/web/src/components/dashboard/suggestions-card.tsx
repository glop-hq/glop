"use client";

import Link from "next/link";
import { useSuggestionsSummary } from "@/hooks/use-suggestions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, FileCode, Terminal, Webhook } from "lucide-react";

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "skill":
      return <FileCode className="h-3 w-3" />;
    case "command":
      return <Terminal className="h-3 w-3" />;
    case "hook":
      return <Webhook className="h-3 w-3" />;
    default:
      return null;
  }
}

export function SuggestionsCard({
  workspaceId,
}: {
  workspaceId: string | undefined;
}) {
  const { data, loading } = useSuggestionsSummary(workspaceId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4" />
            Smart Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total_active === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4" />
            Smart Suggestions
          </CardTitle>
          <Badge variant="secondary">{data.total_active} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Type breakdown */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {Object.entries(data.by_type).map(([type, count]) => (
            <span key={type} className="inline-flex items-center gap-1">
              <TypeIcon type={type} />
              {count} {type}
              {count !== 1 ? "s" : ""}
            </span>
          ))}
        </div>

        {/* Top suggestions */}
        <div className="space-y-2">
          {data.top_suggestions.slice(0, 3).map((s) => (
            <Link
              key={s.id}
              href={`/repos/${s.repo_id}`}
              className="cursor-pointer flex items-start gap-2 rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/50"
            >
              <Badge
                variant={
                  s.suggestion_type === "skill"
                    ? "default"
                    : s.suggestion_type === "command"
                      ? "secondary"
                      : "outline"
                }
                className="shrink-0 gap-1 text-xs"
              >
                <TypeIcon type={s.suggestion_type} />
                {s.suggestion_type}
              </Badge>
              <div className="min-w-0">
                <p className="font-medium text-xs">{s.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {s.repo_display_name || s.repo_key}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
