export interface PermissionRecommendation {
  id: string;
  pattern: string;
  tier: "auto_allow" | "consider" | "keep_manual" | "auto_deny";
  approval_rate: number;
  frequency: number;
  developer_consensus: number;
  est_time_saved_sec: number;
}

export interface PermissionRecommendationsResponse {
  recommendations: PermissionRecommendation[];
  summary: {
    total_patterns: number;
    auto_allow_count: number;
    est_weekly_savings_sec: number;
  };
}

export interface PermissionConfigResponse {
  config: {
    permissions: {
      allow: string[];
      deny: string[];
    };
  };
}

export interface PermissionSavingsResponse {
  weekly_savings_sec: number;
  weekly_savings_display: string;
  prompts_eliminated: number;
}
