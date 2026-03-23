"use client";

import { useCoachingTips, useDismissTip } from "@/hooks/use-coaching-tips";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap,
  BookOpen,
  Shield,
  BarChart3,
  Brain,
  FileCode,
  Star,
  Sparkles,
  X,
  Copy,
} from "lucide-react";
import type { CoachingSourceType } from "@glop/shared";

function SourceIcon({ source }: { source: CoachingSourceType }) {
  switch (source) {
    case "repo_insight":
      return <BarChart3 className="h-3 w-3" />;
    case "readiness":
      return <Shield className="h-3 w-3" />;
    case "facet_pattern":
      return <Brain className="h-3 w-3" />;
    case "context_health":
      return <BookOpen className="h-3 w-3" />;
    case "claude_md":
      return <FileCode className="h-3 w-3" />;
    case "standard":
      return <Star className="h-3 w-3" />;
    case "curated":
      return <Sparkles className="h-3 w-3" />;
    default:
      return null;
  }
}

function sourceLabel(source: CoachingSourceType): string {
  const labels: Record<CoachingSourceType, string> = {
    repo_insight: "Repo insight",
    readiness: "Readiness scan",
    facet_pattern: "Friction pattern",
    context_health: "Context health",
    claude_md: "CLAUDE.md",
    standard: "Standard",
    curated: "Best practice",
  };
  return labels[source] ?? source;
}

export function CoachingTipsCard({
  workspaceId,
}: {
  workspaceId: string | undefined;
}) {
  const { data, loading, refetch } = useCoachingTips(workspaceId);
  const { dismiss, dismissing } = useDismissTip();

  const handleDismiss = async (tipId: string) => {
    const ok = await dismiss(tipId);
    if (ok) refetch();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <GraduationCap className="h-4 w-4" />
            Coaching Tips
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
            <GraduationCap className="h-4 w-4" />
            Coaching Tips
          </CardTitle>
          <Badge variant="secondary">{data.total_active} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Source breakdown */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {Object.entries(data.by_source).map(([source, count]) => (
            <span key={source} className="inline-flex items-center gap-1">
              <SourceIcon source={source as CoachingSourceType} />
              {count} {sourceLabel(source as CoachingSourceType).toLowerCase()}
            </span>
          ))}
        </div>

        {/* Top tips */}
        <div className="space-y-2">
          {data.top_tips.map((tip) => (
            <div
              key={tip.id}
              className="flex items-start gap-2 rounded-md border p-2.5 text-sm"
            >
              <Badge
                variant={
                  tip.priority === "high"
                    ? "destructive"
                    : tip.priority === "medium"
                      ? "default"
                      : "secondary"
                }
                className="shrink-0 gap-1 text-xs"
              >
                <SourceIcon source={tip.source_type} />
                {sourceLabel(tip.source_type)}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-xs">{tip.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {tip.body}
                </p>
                {tip.repo_key && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tip.repo_display_name || tip.repo_key}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {tip.action_type === "copy_to_clipboard" &&
                  tip.action_payload && (
                    <button
                      onClick={() => handleCopy(tip.action_payload!)}
                      className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Copy to clipboard"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                <button
                  onClick={() => handleDismiss(tip.id)}
                  disabled={dismissing === tip.id}
                  className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
