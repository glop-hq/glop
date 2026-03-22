"use client";

import { useFacetStats } from "@/hooks/use-facet-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, AlertTriangle, FolderGit2 } from "lucide-react";

export function OperationalMemorySection({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { stats, loading } = useFacetStats(workspaceId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4" />
            Operational Memory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total_facets === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4" />
            Operational Memory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
            <Brain className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No session facets yet</p>
            <p className="mt-1 text-xs">
              Facets are automatically extracted when Claude Code sessions end.
              Update the CLI to v0.17.0+ to start collecting.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalFriction = Object.values(stats.friction_distribution).reduce(
    (sum, c) => sum + c,
    0
  );
  const topFrictionCategories = Object.entries(stats.friction_distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalOutcomes = Object.values(stats.outcome_distribution).reduce(
    (sum, c) => sum + c,
    0
  );
  const successCount =
    (stats.outcome_distribution.fully_achieved || 0) +
    (stats.outcome_distribution.mostly_achieved || 0);
  const successRate =
    totalOutcomes > 0 ? Math.round((successCount / totalOutcomes) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Brain className="h-4 w-4" />
          Operational Memory
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Last 30 days
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-md bg-muted/50 p-3 text-center">
            <div className="text-lg font-semibold">{stats.recent_facets}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-center">
            <div className="text-lg font-semibold">{stats.recent_repos}</div>
            <div className="text-xs text-muted-foreground">Repos</div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-center">
            <div className="text-lg font-semibold">{stats.recent_developers}</div>
            <div className="text-xs text-muted-foreground">Developers</div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-center">
            <div className="text-lg font-semibold">{successRate}%</div>
            <div className="text-xs text-muted-foreground">Success</div>
          </div>
        </div>

        {/* Top friction categories */}
        {topFrictionCategories.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              Top Friction Categories
            </h4>
            <div className="space-y-1.5">
              {topFrictionCategories.map(([category, count]) => (
                <div key={category} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">
                    {category.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{
                          width: `${Math.min(100, (count / totalFriction) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs text-muted-foreground">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top friction repos */}
        {stats.top_friction_repos.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FolderGit2 className="h-3.5 w-3.5" />
              Repos by Friction
            </h4>
            <div className="space-y-1.5">
              {stats.top_friction_repos.map((repo) => (
                <div
                  key={repo.repo_id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="flex-1 truncate font-mono text-xs">
                    {repo.repo_key}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {repo.friction_count} friction events
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
