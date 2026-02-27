import type { ArtifactInfo } from "@glop/shared";
import { GitPullRequest, Globe, CircleDot } from "lucide-react";

const artifactIcons: Record<string, React.ReactNode> = {
  pr: <GitPullRequest className="h-3.5 w-3.5" />,
  preview: <Globe className="h-3.5 w-3.5" />,
  ci: <CircleDot className="h-3.5 w-3.5" />,
  commit: <CircleDot className="h-3.5 w-3.5" />,
};

const stateColors: Record<string, string> = {
  open: "text-green-600",
  merged: "text-purple-600",
  closed: "text-red-600",
  success: "text-green-600",
  failure: "text-red-600",
  pending: "text-yellow-600",
};

export function ArtifactBadges({
  artifacts,
}: {
  artifacts: ArtifactInfo[];
}) {
  if (artifacts.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {artifacts.map((artifact) => {
        const icon = artifactIcons[artifact.artifact_type] || artifactIcons.commit;
        const colorClass = artifact.state
          ? stateColors[artifact.state] || "text-muted-foreground"
          : "text-muted-foreground";

        if (artifact.url) {
          return (
            <a
              key={artifact.id}
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${colorClass} hover:opacity-70 transition-opacity`}
              title={artifact.label || artifact.artifact_type}
              onClick={(e) => e.stopPropagation()}
            >
              {icon}
            </a>
          );
        }

        return (
          <span
            key={artifact.id}
            className={colorClass}
            title={artifact.label || artifact.artifact_type}
          >
            {icon}
          </span>
        );
      })}
    </div>
  );
}
