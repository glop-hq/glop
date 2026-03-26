CREATE TYPE "public"."access_request_status" AS ENUM('pending');--> statement-breakpoint
CREATE TYPE "public"."activity_kind" AS ENUM('editing', 'reading', 'test_run', 'build_run', 'check_run', 'git_action', 'deploy_action', 'install_deps', 'web_fetch', 'web_search', 'ask_user', 'plan_mode', 'todo_action', 'skill_invoke', 'docker_action', 'waiting', 'blocked', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('pr', 'preview', 'ci', 'commit');--> statement-breakpoint
CREATE TYPE "public"."check_status" AS ENUM('pass', 'warn', 'fail', 'skip');--> statement-breakpoint
CREATE TYPE "public"."claude_item_kind" AS ENUM('skill', 'command');--> statement-breakpoint
CREATE TYPE "public"."coaching_source_type" AS ENUM('repo_insight', 'readiness', 'facet_pattern', 'context_health', 'claude_md', 'standard', 'curated');--> statement-breakpoint
CREATE TYPE "public"."digest_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('run.started', 'run.heartbeat', 'run.phase_changed', 'run.completed', 'run.failed', 'run.prompt', 'run.response', 'run.tool_use', 'run.permission_request', 'run.title_updated', 'run.summary_updated', 'run.context_compacted', 'artifact.added', 'artifact.updated');--> statement-breakpoint
CREATE TYPE "public"."friction_status" AS ENUM('open', 'acknowledged', 'resolved', 'wont_fix');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."mcp_alert_severity" AS ENUM('info', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."mcp_alert_type" AS ENUM('new_mcp_discovered', 'blocked_mcp_usage', 'error_rate_spike', 'mcp_in_new_repo');--> statement-breakpoint
CREATE TYPE "public"."mcp_status" AS ENUM('pending', 'approved', 'flagged', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."mcp_transport" AS ENUM('http', 'sse', 'stdio');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."run_phase" AS ENUM('editing', 'validating', 'waiting', 'done', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('active', 'blocked', 'stale', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_visibility" AS ENUM('private', 'workspace');--> statement-breakpoint
CREATE TYPE "public"."scan_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'completed', 'error');--> statement-breakpoint
CREATE TYPE "public"."shared_link_state" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."standard_type" AS ENUM('skill', 'command', 'hook', 'agent');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('active', 'accepted', 'dismissed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."suggestion_type" AS ENUM('skill', 'command', 'hook');--> statement-breakpoint
CREATE TYPE "public"."tip_action_type" AS ENUM('copy_to_clipboard', 'open_link', 'dismiss');--> statement-breakpoint
CREATE TYPE "public"."tip_priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."tip_status" AS ENUM('active', 'delivered', 'engaged', 'dismissed', 'expired');--> statement-breakpoint
CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"status" "access_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"developer_id" text NOT NULL,
	"developer_name" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"artifact_type" "artifact_type" NOT NULL,
	"url" text,
	"label" text,
	"external_id" text,
	"state" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claude_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "claude_item_kind" NOT NULL,
	"name" text NOT NULL,
	"file_path" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claude_md_directives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"directive" text NOT NULL,
	"source_file" text NOT NULL,
	"source_line" integer,
	"category" text NOT NULL,
	"sessions_relevant" integer DEFAULT 0 NOT NULL,
	"sessions_followed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coaching_tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"repo_id" uuid,
	"workspace_id" uuid NOT NULL,
	"source_type" "coaching_source_type" NOT NULL,
	"source_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_type" "tip_action_type" NOT NULL,
	"action_payload" text,
	"priority" "tip_priority" NOT NULL,
	"status" "tip_status" DEFAULT 'active' NOT NULL,
	"delivered_via" text,
	"delivered_at" timestamp with time zone,
	"engaged_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"dismiss_reason" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curated_tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" text NOT NULL,
	"friction_match" text,
	"repo_type_match" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"display_name" text,
	"email" text,
	"identity_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avatar_url" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_active_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digest_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"frequency" "digest_frequency" DEFAULT 'weekly' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" "event_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"run_id" uuid NOT NULL,
	"developer_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"repo_key" text NOT NULL,
	"branch_name" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friction_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repo_id" uuid,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"frequency" integer NOT NULL,
	"severity" integer NOT NULL,
	"recency_weight" real NOT NULL,
	"impact_score" real NOT NULL,
	"affected_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_action" text,
	"status" "friction_status" DEFAULT 'open' NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workspace_mcp_id" uuid,
	"alert_type" "mcp_alert_type" NOT NULL,
	"severity" "mcp_alert_severity" NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_mcp_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_mcp_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"call_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workspace_mcp_id" uuid NOT NULL,
	"mcp_tool_id" uuid,
	"run_id" uuid NOT NULL,
	"event_id" uuid,
	"repo_id" uuid,
	"developer_entity_id" uuid,
	"tool_name" text NOT NULL,
	"is_error" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"event_id" uuid,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"developer_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"tool_args" text,
	"pattern" text NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"tier" text NOT NULL,
	"approval_rate" real NOT NULL,
	"frequency" integer NOT NULL,
	"developer_consensus" real NOT NULL,
	"est_time_saved_sec" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_context_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recommended_max_duration_min" integer,
	"confidence" text NOT NULL,
	"sample_size" integer NOT NULL,
	"reasoning" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repo_context_recommendations_repo_id_unique" UNIQUE("repo_id")
);
--> statement-breakpoint
CREATE TABLE "repo_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"session_count" integer NOT NULL,
	"developer_count" integer NOT NULL,
	"outcome_distribution" jsonb NOT NULL,
	"friction_analysis" jsonb NOT NULL,
	"success_patterns" jsonb NOT NULL,
	"claude_md_suggestions" jsonb NOT NULL,
	"file_coupling" jsonb NOT NULL,
	"area_complexity" jsonb NOT NULL,
	"generated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_scan_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"check_id" text NOT NULL,
	"status" "check_status" NOT NULL,
	"severity" "scan_severity" NOT NULL,
	"weight" integer NOT NULL,
	"score" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recommendation" text,
	"fix_available" boolean DEFAULT false NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"score" integer,
	"status" "scan_status" DEFAULT 'pending' NOT NULL,
	"triggered_by" text NOT NULL,
	"error_message" text,
	"permission_health_score" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repo_key" text NOT NULL,
	"display_name" text,
	"description" text,
	"default_branch" text,
	"language" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_active_at" timestamp with time zone NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_context_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"compaction_count" integer DEFAULT 0 NOT NULL,
	"first_compaction_at_min" real,
	"peak_utilization_pct" real,
	"end_utilization_pct" real,
	"total_input_tokens" integer,
	"total_output_tokens" integer,
	"context_limit_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_context_health_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "run_mcp_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"mcp_server" text NOT NULL,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"developer_entity_id" uuid,
	"repo_id" uuid,
	"developer_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"repo_key" text NOT NULL,
	"branch_name" text NOT NULL,
	"session_id" text,
	"slug" text,
	"status" "run_status" DEFAULT 'active' NOT NULL,
	"phase" "run_phase" DEFAULT 'unknown' NOT NULL,
	"activity_kind" "activity_kind" DEFAULT 'unknown' NOT NULL,
	"git_user_name" text,
	"git_user_email" text,
	"title" text,
	"summary" text,
	"current_action" text,
	"last_action_label" text,
	"file_count" integer DEFAULT 0 NOT NULL,
	"files_touched" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visibility" "run_visibility" DEFAULT 'private' NOT NULL,
	"shared_link_state" "shared_link_state",
	"shared_link_expires_at" timestamp with time zone,
	"share_created_at" timestamp with time zone,
	"started_at" timestamp with time zone NOT NULL,
	"last_heartbeat_at" timestamp with time zone NOT NULL,
	"last_event_at" timestamp with time zone NOT NULL,
	"parent_run_id" uuid,
	"completed_at" timestamp with time zone,
	"event_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_facets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"developer_entity_id" uuid,
	"developer_id" text NOT NULL,
	"goal_categories" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"satisfaction" text NOT NULL,
	"session_type" text NOT NULL,
	"friction_counts" jsonb NOT NULL,
	"friction_detail" text,
	"primary_success" text,
	"files_touched" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"area" text,
	"brief_summary" text NOT NULL,
	"duration_minutes" integer,
	"iteration_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_facets_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "standard_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"suggestion_type" "suggestion_type" NOT NULL,
	"title" text NOT NULL,
	"rationale" text NOT NULL,
	"draft_content" text NOT NULL,
	"draft_filename" text NOT NULL,
	"pattern_type" text NOT NULL,
	"pattern_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "suggestion_status" DEFAULT 'active' NOT NULL,
	"dismiss_reason" text,
	"accepted_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standard_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"event_id" uuid,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"developer_entity_id" uuid,
	"standard_id" uuid,
	"standard_name" text NOT NULL,
	"standard_type" "standard_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invite_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"token" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invite_links_workspace_id_unique" UNIQUE("workspace_id"),
	CONSTRAINT "workspace_invite_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspace_mcps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"canonical_id" text NOT NULL,
	"transport" "mcp_transport" NOT NULL,
	"display_name" text,
	"description" text,
	"status" "mcp_status" DEFAULT 'pending' NOT NULL,
	"setup_guidance" text,
	"status_note" text,
	"status_changed_by" text,
	"status_changed_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"default_run_visibility" "run_visibility" DEFAULT 'workspace' NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_items" ADD CONSTRAINT "claude_items_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_items" ADD CONSTRAINT "claude_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_md_directives" ADD CONSTRAINT "claude_md_directives_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_md_directives" ADD CONSTRAINT "claude_md_directives_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_tips" ADD CONSTRAINT "coaching_tips_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_tips" ADD CONSTRAINT "coaching_tips_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_tips" ADD CONSTRAINT "coaching_tips_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developers" ADD CONSTRAINT "developers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_schedules" ADD CONSTRAINT "digest_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_schedules" ADD CONSTRAINT "digest_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friction_insights" ADD CONSTRAINT "friction_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friction_insights" ADD CONSTRAINT "friction_insights_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_alerts" ADD CONSTRAINT "mcp_alerts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_alerts" ADD CONSTRAINT "mcp_alerts_workspace_mcp_id_workspace_mcps_id_fk" FOREIGN KEY ("workspace_mcp_id") REFERENCES "public"."workspace_mcps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_aliases" ADD CONSTRAINT "mcp_aliases_workspace_mcp_id_workspace_mcps_id_fk" FOREIGN KEY ("workspace_mcp_id") REFERENCES "public"."workspace_mcps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tools" ADD CONSTRAINT "mcp_tools_workspace_mcp_id_workspace_mcps_id_fk" FOREIGN KEY ("workspace_mcp_id") REFERENCES "public"."workspace_mcps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_workspace_mcp_id_workspace_mcps_id_fk" FOREIGN KEY ("workspace_mcp_id") REFERENCES "public"."workspace_mcps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_mcp_tool_id_mcp_tools_id_fk" FOREIGN KEY ("mcp_tool_id") REFERENCES "public"."mcp_tools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_developer_entity_id_developers_id_fk" FOREIGN KEY ("developer_entity_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_events" ADD CONSTRAINT "permission_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_events" ADD CONSTRAINT "permission_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_events" ADD CONSTRAINT "permission_events_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_events" ADD CONSTRAINT "permission_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_recommendations" ADD CONSTRAINT "permission_recommendations_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_recommendations" ADD CONSTRAINT "permission_recommendations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_context_recommendations" ADD CONSTRAINT "repo_context_recommendations_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_context_recommendations" ADD CONSTRAINT "repo_context_recommendations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_insights" ADD CONSTRAINT "repo_insights_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_insights" ADD CONSTRAINT "repo_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_scan_checks" ADD CONSTRAINT "repo_scan_checks_scan_id_repo_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."repo_scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_scans" ADD CONSTRAINT "repo_scans_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_scans" ADD CONSTRAINT "repo_scans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_context_health" ADD CONSTRAINT "run_context_health_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_context_health" ADD CONSTRAINT "run_context_health_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_context_health" ADD CONSTRAINT "run_context_health_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_mcp_usage" ADD CONSTRAINT "run_mcp_usage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_mcp_usage" ADD CONSTRAINT "run_mcp_usage_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_mcp_usage" ADD CONSTRAINT "run_mcp_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_developer_entity_id_developers_id_fk" FOREIGN KEY ("developer_entity_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_facets" ADD CONSTRAINT "session_facets_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_facets" ADD CONSTRAINT "session_facets_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_facets" ADD CONSTRAINT "session_facets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_facets" ADD CONSTRAINT "session_facets_developer_entity_id_developers_id_fk" FOREIGN KEY ("developer_entity_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_suggestions" ADD CONSTRAINT "standard_suggestions_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_suggestions" ADD CONSTRAINT "standard_suggestions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_developer_entity_id_developers_id_fk" FOREIGN KEY ("developer_entity_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_standard_id_claude_items_id_fk" FOREIGN KEY ("standard_id") REFERENCES "public"."claude_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_mcps" ADD CONSTRAINT "workspace_mcps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_requests_run_requester_idx" ON "access_requests" USING btree ("run_id","requester_user_id");--> statement-breakpoint
CREATE INDEX "access_requests_owner_user_id_idx" ON "access_requests" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "artifacts_run_id_idx" ON "artifacts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "claude_items_workspace_id_idx" ON "claude_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "claude_items_repo_id_idx" ON "claude_items" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claude_items_repo_kind_name_idx" ON "claude_items" USING btree ("repo_id","kind","name");--> statement-breakpoint
CREATE INDEX "claude_md_directives_repo_id_idx" ON "claude_md_directives" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "claude_md_directives_workspace_id_idx" ON "claude_md_directives" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "coaching_tips_developer_status_idx" ON "coaching_tips" USING btree ("developer_id","status");--> statement-breakpoint
CREATE INDEX "coaching_tips_repo_status_idx" ON "coaching_tips" USING btree ("repo_id","status");--> statement-breakpoint
CREATE INDEX "coaching_tips_workspace_created_idx" ON "coaching_tips" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "developers_workspace_id_idx" ON "developers" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "developers_workspace_email_idx" ON "developers" USING btree ("workspace_id","email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "digest_schedules_user_workspace_idx" ON "digest_schedules" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "events_run_id_idx" ON "events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "events_occurred_at_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "friction_insights_workspace_id_idx" ON "friction_insights" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "friction_insights_impact_score_idx" ON "friction_insights" USING btree ("impact_score");--> statement-breakpoint
CREATE INDEX "friction_insights_repo_id_idx" ON "friction_insights" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "mcp_alerts_workspace_id_ack_created_idx" ON "mcp_alerts" USING btree ("workspace_id","acknowledged","created_at");--> statement-breakpoint
CREATE INDEX "mcp_alerts_workspace_mcp_id_idx" ON "mcp_alerts" USING btree ("workspace_mcp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_aliases_mcp_alias_idx" ON "mcp_aliases" USING btree ("workspace_mcp_id","alias");--> statement-breakpoint
CREATE INDEX "mcp_aliases_alias_idx" ON "mcp_aliases" USING btree ("alias");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_tools_mcp_tool_idx" ON "mcp_tools" USING btree ("workspace_mcp_id","tool_name");--> statement-breakpoint
CREATE INDEX "mcp_usage_workspace_mcp_id_occurred_at_idx" ON "mcp_usage" USING btree ("workspace_mcp_id","occurred_at");--> statement-breakpoint
CREATE INDEX "mcp_usage_workspace_id_occurred_at_idx" ON "mcp_usage" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "mcp_usage_run_id_idx" ON "mcp_usage" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "permission_events_repo_pattern_created_idx" ON "permission_events" USING btree ("repo_id","pattern","created_at");--> statement-breakpoint
CREATE INDEX "permission_events_workspace_id_idx" ON "permission_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "permission_events_run_id_idx" ON "permission_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "permission_recommendations_repo_tier_idx" ON "permission_recommendations" USING btree ("repo_id","tier");--> statement-breakpoint
CREATE INDEX "permission_recommendations_workspace_id_idx" ON "permission_recommendations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "repo_insights_repo_id_created_at_idx" ON "repo_insights" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "repo_insights_workspace_id_idx" ON "repo_insights" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "repo_scan_checks_scan_id_idx" ON "repo_scan_checks" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "repo_scans_repo_id_idx" ON "repo_scans" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "repo_scans_repo_id_created_at_idx" ON "repo_scans" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "repos_workspace_id_idx" ON "repos" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_workspace_repo_key_idx" ON "repos" USING btree ("workspace_id","repo_key");--> statement-breakpoint
CREATE INDEX "run_context_health_repo_id_created_at_idx" ON "run_context_health" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "run_context_health_workspace_id_created_at_idx" ON "run_context_health" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "run_mcp_usage_repo_id_mcp_server_idx" ON "run_mcp_usage" USING btree ("repo_id","mcp_server");--> statement-breakpoint
CREATE UNIQUE INDEX "run_mcp_usage_run_id_mcp_server_idx" ON "run_mcp_usage" USING btree ("run_id","mcp_server");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_last_event_at_idx" ON "runs" USING btree ("last_event_at");--> statement-breakpoint
CREATE INDEX "runs_identity_idx" ON "runs" USING btree ("developer_id","machine_id","repo_key","branch_name");--> statement-breakpoint
CREATE INDEX "runs_session_id_idx" ON "runs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "runs_slug_idx" ON "runs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "runs_workspace_id_idx" ON "runs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "runs_owner_user_id_idx" ON "runs" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "runs_visibility_idx" ON "runs" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "runs_parent_run_id_idx" ON "runs" USING btree ("parent_run_id");--> statement-breakpoint
CREATE INDEX "runs_developer_entity_id_idx" ON "runs" USING btree ("developer_entity_id");--> statement-breakpoint
CREATE INDEX "runs_repo_id_idx" ON "runs" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "session_facets_repo_id_created_at_idx" ON "session_facets" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "session_facets_workspace_id_created_at_idx" ON "session_facets" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "standard_suggestions_repo_status_idx" ON "standard_suggestions" USING btree ("repo_id","status");--> statement-breakpoint
CREATE INDEX "standard_suggestions_workspace_status_idx" ON "standard_suggestions" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "standard_usage_repo_name_created_idx" ON "standard_usage" USING btree ("repo_id","standard_name","created_at");--> statement-breakpoint
CREATE INDEX "standard_usage_workspace_type_idx" ON "standard_usage" USING btree ("workspace_id","standard_type");--> statement-breakpoint
CREATE INDEX "standard_usage_run_id_idx" ON "standard_usage" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "standard_usage_standard_id_idx" ON "standard_usage" USING btree ("standard_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_account_idx" ON "users" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_id_idx" ON "workspace_invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invitations_email_status_idx" ON "workspace_invitations" USING btree ("email","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_mcps_workspace_canonical_idx" ON "workspace_mcps" USING btree ("workspace_id","canonical_id");--> statement-breakpoint
CREATE INDEX "workspace_mcps_workspace_id_idx" ON "workspace_mcps" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_mcps_workspace_status_idx" ON "workspace_mcps" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_unique_idx" ON "workspace_members" USING btree ("workspace_id","user_id");