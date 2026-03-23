"use client";

import { useState } from "react";
import { useSuggestions } from "@/hooks/use-suggestions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Copy,
  FileCode,
  Terminal,
  Webhook,
} from "lucide-react";
import type { StandardSuggestion } from "@glop/shared";

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "skill":
      return <FileCode className="h-3.5 w-3.5" />;
    case "command":
      return <Terminal className="h-3.5 w-3.5" />;
    case "hook":
      return <Webhook className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function typeBadgeVariant(
  type: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "skill":
      return "default";
    case "command":
      return "secondary";
    case "hook":
      return "outline";
    default:
      return "secondary";
  }
}

function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
}: {
  suggestion: StandardSuggestion;
  onAccept: () => void;
  onDismiss: (reason?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(suggestion.draft_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Badge variant={typeBadgeVariant(suggestion.suggestion_type)} className="shrink-0 gap-1">
            <TypeIcon type={suggestion.suggestion_type} />
            {suggestion.suggestion_type}
          </Badge>
          <div className="min-w-0">
            <h4 className="text-sm font-medium">{suggestion.title}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {suggestion.rationale}
            </p>
          </div>
        </div>
      </div>

      {/* Draft filename */}
      <div className="flex items-center gap-2 text-xs">
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
          {suggestion.draft_filename}
        </code>
        <button
          onClick={handleCopy}
          className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Copy draft content"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Expandable draft content */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {expanded ? "Hide draft" : "View draft content"}
      </button>

      {expanded && (
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
          {suggestion.draft_content}
        </pre>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {dismissing ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Reason:</span>
            {(
              [
                ["not_relevant", "Not relevant"],
                ["already_handled", "Already handled"],
                ["will_do_later", "Later"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  onDismiss(value);
                  setDismissing(false);
                }}
                disabled={updating}
                className="cursor-pointer rounded border px-2 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setDismissing(false)}
              className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => {
                setUpdating(true);
                onAccept();
              }}
              disabled={updating}
              className="cursor-pointer inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              Accept
            </button>
            <button
              onClick={() => setDismissing(true)}
              disabled={updating}
              className="cursor-pointer inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function RepoSuggestions({
  repoId,
}: {
  workspaceId: string;
  repoId: string;
}) {
  const { suggestions, loading, refetch } = useSuggestions(repoId);

  const updateStatus = async (
    id: string,
    status: "accepted" | "dismissed",
    dismiss_reason?: string
  ) => {
    try {
      const res = await fetch(`/api/v1/suggestions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, dismiss_reason }),
      });
      if (res.ok) {
        refetch();
      }
    } catch {
      // Refetch to reset card states on failure
      refetch();
    }
  };

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
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4" />
            Smart Suggestions
            {suggestions.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {suggestions.length}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
            <Lightbulb className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No suggestions yet</p>
            <p className="mt-1 text-xs">
              Run{" "}
              <code className="rounded bg-muted px-1">glop insights</code> to
              generate skill, command, and hook suggestions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={() => updateStatus(s.id, "accepted")}
                onDismiss={(reason) => updateStatus(s.id, "dismissed", reason)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
