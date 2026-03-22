"use client";

import { useState } from "react";
import { useRepoInsights } from "@/hooks/use-repo-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  FileCode,
  Brain,
  Terminal,
} from "lucide-react";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function RepoInsights({
  workspaceId,
  repoId,
}: {
  workspaceId: string;
  repoId: string;
}) {
  const { insight, loading } = useRepoInsights(workspaceId, repoId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4" />
            Operational Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insight) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4" />
            Operational Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
            <Brain className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No insights generated yet</p>
            <p className="mt-1 text-xs">
              Run <code className="rounded bg-muted px-1">glop insights</code>{" "}
              after accumulating session data
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const successRate = insight.session_count > 0
    ? Math.round(
        ((insight.outcome_distribution.fully_achieved || 0) +
          (insight.outcome_distribution.mostly_achieved || 0)) /
          insight.session_count *
          100
      )
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4" />
            Operational Insights
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Generated {formatRelativeTime(insight.created_at)} · {insight.session_count} sessions · {insight.developer_count} dev(s)
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md bg-muted/50 p-3 text-center">
            <div className="text-lg font-semibold">{insight.session_count}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-center">
            <div className="text-lg font-semibold">{successRate}%</div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-center">
            <div className="text-lg font-semibold">{insight.developer_count}</div>
            <div className="text-xs text-muted-foreground">Developers</div>
          </div>
        </div>

        {/* Friction hotspots */}
        {insight.friction_analysis.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              Friction Hotspots
            </h4>
            <div className="space-y-2">
              {insight.friction_analysis.map((f, i) => (
                <div
                  key={i}
                  className="rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {f.category.replace(/_/g, " ")}
                    </Badge>
                    {f.area && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {f.area}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {f.count}x
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success patterns */}
        {insight.success_patterns.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              What Works Well
            </h4>
            <div className="space-y-2">
              {insight.success_patterns.map((s, i) => (
                <div
                  key={i}
                  className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {s.pattern.replace(/_/g, " ")}
                    </Badge>
                    {s.area && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.area}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLAUDE.md suggestions */}
        {insight.claude_md_suggestions.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" />
              CLAUDE.md Suggestions
            </h4>
            <div className="space-y-1.5">
              {insight.claude_md_suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5 text-sm"
                >
                  <code className="flex-1 text-xs">{s}</code>
                  <CopyButton text={s} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File coupling */}
        {insight.file_coupling.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileCode className="h-3.5 w-3.5" />
              File Coupling
            </h4>
            <div className="space-y-1.5">
              {insight.file_coupling.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="font-mono">
                    {c.files.join(" ↔ ")}
                  </span>
                  <span className="text-muted-foreground">
                    ({Math.round(c.frequency * 100)}% co-change)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
