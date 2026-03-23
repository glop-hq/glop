CREATE TYPE "public"."standard_type" AS ENUM('skill', 'command', 'hook', 'agent');--> statement-breakpoint
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
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_developer_entity_id_developers_id_fk" FOREIGN KEY ("developer_entity_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_usage" ADD CONSTRAINT "standard_usage_standard_id_claude_items_id_fk" FOREIGN KEY ("standard_id") REFERENCES "public"."claude_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standard_usage_repo_name_created_idx" ON "standard_usage" USING btree ("repo_id","standard_name","created_at");--> statement-breakpoint
CREATE INDEX "standard_usage_workspace_type_idx" ON "standard_usage" USING btree ("workspace_id","standard_type");--> statement-breakpoint
CREATE INDEX "standard_usage_run_id_idx" ON "standard_usage" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "standard_usage_standard_id_idx" ON "standard_usage" USING btree ("standard_id");