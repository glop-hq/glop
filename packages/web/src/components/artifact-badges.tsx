import type { ArtifactInfo } from "@glop/shared";
import { GitPullRequest, GitCommitHorizontal, Globe, CircleDot } from "lucide-react";

export function ArtifactBadges({
  artifacts,
}: {
  artifacts: ArtifactInfo[];
}) {
  if (artifacts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {[...artifacts].sort((a, b) => (a.artifact_type === "pr" ? -1 : b.artifact_type === "pr" ? 1 : 0)).map((artifact) => {
        if (artifact.artifact_type === "commit") {
          const content = (
            <>
              <GitCommitHorizontal className="h-3 w-3" />
              {artifact.external_id?.slice(0, 7)}
            </>
          );
          return artifact.url ? (
            <a
              key={artifact.id}
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              title={artifact.label || undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {content}
            </a>
          ) : (
            <span
              key={artifact.id}
              className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground"
              title={artifact.label || undefined}
            >
              {content}
            </span>
          );
        }

        if (artifact.artifact_type === "pr") {
          return (
            <a
              key={artifact.id}
              href={artifact.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              title={artifact.label || undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <GitPullRequest className="h-3 w-3" />
              #{artifact.external_id}
            </a>
          );
        }

        // Fallback for other types (preview, ci)
        const icon =
          artifact.artifact_type === "preview" ? (
            <Globe className="h-3 w-3" />
          ) : (
            <CircleDot className="h-3 w-3" />
          );
        return artifact.url ? (
          <a
            key={artifact.id}
            href={artifact.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            title={artifact.label || artifact.artifact_type}
            onClick={(e) => e.stopPropagation()}
          >
            {icon}
            {artifact.label || artifact.artifact_type}
          </a>
        ) : (
          <span
            key={artifact.id}
            className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground"
            title={artifact.label || artifact.artifact_type}
          >
            {icon}
            {artifact.label || artifact.artifact_type}
          </span>
        );
      })}
    </div>
  );
}
