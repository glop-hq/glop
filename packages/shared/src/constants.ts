/** Run goes stale after 5 minutes without heartbeat */
export const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/** Run auto-closes after 60 minutes without heartbeat */
export const AUTO_CLOSE_THRESHOLD_MS = 60 * 60 * 1000;

/** Live board poll interval */
export const LIVE_POLL_INTERVAL_MS = 3000;

/** Run detail poll interval */
export const DETAIL_POLL_INTERVAL_MS = 5000;

/** Background stale checker sweep interval */
export const STALE_SWEEP_INTERVAL_MS = 30 * 1000;

/** Status display precedence (higher index = higher priority) */
export const STATUS_PRECEDENCE = [
  "completed",
  "failed",
  "stale",
  "blocked",
  "active",
] as const;

/** Phase colors for UI */
export const PHASE_COLORS: Record<string, string> = {
  editing: "blue",
  validating: "yellow",
  waiting: "orange",
  done: "green",
  failed: "red",
  unknown: "gray",
};

/** Status colors for UI */
export const STATUS_COLORS: Record<string, string> = {
  active: "green",
  blocked: "amber",
  stale: "gray",
  completed: "green",
  failed: "red",
};

/** Default share link expiry in days */
export const DEFAULT_SHARE_EXPIRY_DAYS = 30;
