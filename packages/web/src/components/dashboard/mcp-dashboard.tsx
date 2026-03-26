"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useMcpInventory } from "@/hooks/use-mcp-inventory";
import { useMcpAlerts } from "@/hooks/use-mcp-alerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsPeriod, McpStatus, McpServer, McpAlert } from "@glop/shared";

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const STATUS_COLORS: Record<McpStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  flagged: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_OPTIONS: McpStatus[] = ["pending", "approved", "flagged", "blocked"];

function McpStatusBadge({ status }: { status: McpStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_COLORS[status]
      )}
    >
      {status}
    </span>
  );
}

function KpiStat({
  title,
  value,
  loading,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  loading: boolean;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="space-y-1 px-6 py-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color ?? "text-muted-foreground")} />
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <p className="text-xl font-bold">{value}</p>
      )}
    </div>
  );
}

function McpRow({
  mcp,
  workspaceId,
  isAdmin,
  onStatusChange,
  onClick,
}: {
  mcp: McpServer;
  workspaceId: string;
  isAdmin: boolean;
  onStatusChange: () => void;
  onClick: () => void;
}) {
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    setUpdating(true);
    try {
      await fetch(`/api/v1/mcps/${mcp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          status: e.target.value,
        }),
      });
      onStatusChange();
    } finally {
      setUpdating(false);
    }
  };

  const errorRate =
    mcp.usage_count > 0
      ? Math.round((mcp.error_count / mcp.usage_count) * 100)
      : 0;

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b transition-colors hover:bg-muted/50"
    >
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-sm">
            {mcp.display_name || mcp.aliases[0] || mcp.canonical_id}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
            {mcp.canonical_id}
          </p>
        </div>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {isAdmin ? (
          <select
            value={mcp.status}
            onChange={handleStatusChange}
            disabled={updating}
            className="cursor-pointer rounded-md border bg-background px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        ) : (
          <McpStatusBadge status={mcp.status} />
        )}
      </td>
      <td className="px-4 py-3 text-sm text-center">{mcp.developer_count}</td>
      <td className="px-4 py-3 text-sm text-center">{mcp.repo_count}</td>
      <td className="px-4 py-3 text-sm text-center">{mcp.usage_count}</td>
      <td className="px-4 py-3 text-sm text-center">
        {errorRate > 0 ? (
          <span className={errorRate > 20 ? "text-red-600 dark:text-red-400" : ""}>
            {errorRate}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {mcp.tools.length} tools
      </td>
    </tr>
  );
}

function AlertRow({
  alert,
  workspaceId,
  onAcknowledge,
}: {
  alert: McpAlert;
  workspaceId: string;
  onAcknowledge: () => void;
}) {
  const [acking, setAcking] = useState(false);

  const handleAcknowledge = async () => {
    setAcking(true);
    try {
      await fetch(`/api/v1/mcps/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      onAcknowledge();
    } finally {
      setAcking(false);
    }
  };

  const severityColor =
    alert.severity === "high"
      ? "text-red-600 dark:text-red-400"
      : alert.severity === "medium"
        ? "text-orange-600 dark:text-orange-400"
        : "text-muted-foreground";

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border p-3">
      <div className="space-y-1 min-w-0">
        <p className={cn("text-sm font-medium", severityColor)}>{alert.title}</p>
        {alert.detail && (
          <p className="text-xs text-muted-foreground truncate">{alert.detail}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {new Date(alert.created_at).toLocaleDateString()}
        </p>
      </div>
      {!alert.acknowledged && (
        <button
          onClick={handleAcknowledge}
          disabled={acking}
          className="cursor-pointer shrink-0 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted"
        >
          Ack
        </button>
      )}
    </div>
  );
}

export function McpDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { currentWorkspace } = useWorkspaces();
  const router = useRouter();

  // Admin enforcement is server-side; show controls to all members
  const isAdmin = true;

  const { data, loading, refetch } = useMcpInventory(
    currentWorkspace?.id,
    period
  );
  const {
    data: alerts,
    loading: alertsLoading,
    refetch: refetchAlerts,
  } = useMcpAlerts(currentWorkspace?.id, false);

  const handleRefresh = () => {
    refetch();
    refetchAlerts();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/standards"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">MCP Servers & Compliance</h1>
            <p className="text-sm text-muted-foreground">
              Visibility into MCP integrations across your workspace
            </p>
          </div>
        </div>
        <div className="flex rounded-lg border bg-muted p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <Card>
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <KpiStat
            title="Total MCPs"
            value={String(data?.compliance.total_mcps ?? 0)}
            loading={loading}
            icon={Shield}
          />
          <KpiStat
            title="Approved"
            value={String(data?.compliance.by_status.approved ?? 0)}
            loading={loading}
            icon={CheckCircle}
            color="text-green-600 dark:text-green-400"
          />
          <KpiStat
            title="Pending"
            value={String(data?.compliance.by_status.pending ?? 0)}
            loading={loading}
            icon={Clock}
            color="text-yellow-600 dark:text-yellow-400"
          />
          <KpiStat
            title="Flagged"
            value={String(data?.compliance.by_status.flagged ?? 0)}
            loading={loading}
            icon={AlertTriangle}
            color="text-orange-600 dark:text-orange-400"
          />
          <KpiStat
            title="Blocked"
            value={String(data?.compliance.by_status.blocked ?? 0)}
            loading={loading}
            icon={Ban}
            color="text-red-600 dark:text-red-400"
          />
          <KpiStat
            title="Compliance Rate"
            value={`${data?.compliance.compliance_rate ?? 0}%`}
            loading={loading}
            icon={Shield}
          />
        </div>
      </Card>

      {/* Content: Table + Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* MCP Inventory Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              MCP Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !data?.mcps.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No MCP servers discovered yet. MCPs will appear here once
                developers start using them.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">MCP Server</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium text-center">Devs</th>
                      <th className="px-4 py-2 font-medium text-center">Repos</th>
                      <th className="px-4 py-2 font-medium text-center">Calls</th>
                      <th className="px-4 py-2 font-medium text-center">Errors</th>
                      <th className="px-4 py-2 font-medium">Tools</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mcps.map((mcp) => (
                      <McpRow
                        key={mcp.id}
                        mcp={mcp}
                        workspaceId={currentWorkspace?.id ?? ""}
                        isAdmin={isAdmin}
                        onStatusChange={handleRefresh}
                        onClick={() =>
                          router.push(
                            `/standards/mcps/${mcp.id}?workspace_id=${currentWorkspace?.id}`
                          )
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              Recent Alerts
              {alerts && alerts.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {alerts.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !alerts?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No unacknowledged alerts
              </p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {alerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    workspaceId={currentWorkspace?.id ?? ""}
                    onAcknowledge={handleRefresh}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
