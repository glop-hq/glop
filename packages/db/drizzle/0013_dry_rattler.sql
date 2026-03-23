CREATE TYPE "public"."mcp_alert_severity" AS ENUM('info', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."mcp_alert_type" AS ENUM('new_mcp_discovered', 'blocked_mcp_usage', 'error_rate_spike', 'mcp_in_new_repo');--> statement-breakpoint
CREATE TYPE "public"."mcp_status" AS ENUM('pending', 'approved', 'flagged', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."mcp_transport" AS ENUM('http', 'sse', 'stdio');--> statement-breakpoint
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
ALTER TABLE "workspace_mcps" ADD CONSTRAINT "workspace_mcps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_alerts_workspace_id_ack_created_idx" ON "mcp_alerts" USING btree ("workspace_id","acknowledged","created_at");--> statement-breakpoint
CREATE INDEX "mcp_alerts_workspace_mcp_id_idx" ON "mcp_alerts" USING btree ("workspace_mcp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_aliases_mcp_alias_idx" ON "mcp_aliases" USING btree ("workspace_mcp_id","alias");--> statement-breakpoint
CREATE INDEX "mcp_aliases_alias_idx" ON "mcp_aliases" USING btree ("alias");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_tools_mcp_tool_idx" ON "mcp_tools" USING btree ("workspace_mcp_id","tool_name");--> statement-breakpoint
CREATE INDEX "mcp_usage_workspace_mcp_id_occurred_at_idx" ON "mcp_usage" USING btree ("workspace_mcp_id","occurred_at");--> statement-breakpoint
CREATE INDEX "mcp_usage_workspace_id_occurred_at_idx" ON "mcp_usage" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "mcp_usage_run_id_idx" ON "mcp_usage" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_mcps_workspace_canonical_idx" ON "workspace_mcps" USING btree ("workspace_id","canonical_id");--> statement-breakpoint
CREATE INDEX "workspace_mcps_workspace_id_idx" ON "workspace_mcps" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_mcps_workspace_status_idx" ON "workspace_mcps" USING btree ("workspace_id","status");