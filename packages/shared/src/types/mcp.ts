// ── MCP Visibility & Compliance ──────────────────────────────────

export type McpStatus = "pending" | "approved" | "flagged" | "blocked";
export type McpTransport = "http" | "sse" | "stdio";
export type McpAlertType =
  | "new_mcp_discovered"
  | "blocked_mcp_usage"
  | "error_rate_spike"
  | "mcp_in_new_repo";
export type McpAlertSeverity = "info" | "low" | "medium" | "high";

export interface McpTool {
  id: string;
  tool_name: string;
  call_count: number;
  error_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface McpServer {
  id: string;
  canonical_id: string;
  transport: McpTransport;
  display_name: string | null;
  description: string | null;
  status: McpStatus;
  setup_guidance: string | null;
  status_note: string | null;
  aliases: string[];
  tools: McpTool[];
  usage_count: number;
  error_count: number;
  repo_count: number;
  developer_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface McpComplianceSummary {
  total_mcps: number;
  by_status: Record<McpStatus, number>;
  compliance_rate: number;
  total_usage: number;
  approved_usage: number;
  recent_alerts: number;
}

export interface McpSyncPayload {
  workspace_id: string;
  repo_key: string;
  mcps: Array<{
    server_name: string;
    canonical_id: string;
    transport: McpTransport;
  }>;
}

export interface McpAlert {
  id: string;
  alert_type: McpAlertType;
  severity: McpAlertSeverity;
  title: string;
  detail: string | null;
  context: Record<string, unknown>;
  mcp_id: string | null;
  mcp_canonical_id: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  created_at: string;
}

export interface McpInventoryResponse {
  mcps: McpServer[];
  compliance: McpComplianceSummary;
}

export interface McpDetailResponse {
  mcp: McpServer;
  usage_timeline: Array<{ date: string; calls: number; errors: number }>;
  repos: Array<{ repo_id: string; repo_key: string; call_count: number }>;
  developers: Array<{
    developer_id: string;
    display_name: string | null;
    call_count: number;
  }>;
}
