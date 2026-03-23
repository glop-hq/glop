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
ALTER TABLE "permission_events" ADD CONSTRAINT "permission_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_events" ADD CONSTRAINT "permission_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_events" ADD CONSTRAINT "permission_events_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_events" ADD CONSTRAINT "permission_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_recommendations" ADD CONSTRAINT "permission_recommendations_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_recommendations" ADD CONSTRAINT "permission_recommendations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "permission_events_repo_pattern_created_idx" ON "permission_events" USING btree ("repo_id","pattern","created_at");--> statement-breakpoint
CREATE INDEX "permission_events_workspace_id_idx" ON "permission_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "permission_events_run_id_idx" ON "permission_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "permission_recommendations_repo_tier_idx" ON "permission_recommendations" USING btree ("repo_id","tier");--> statement-breakpoint
CREATE INDEX "permission_recommendations_workspace_id_idx" ON "permission_recommendations" USING btree ("workspace_id");