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
ALTER TABLE "repo_context_recommendations" ADD CONSTRAINT "repo_context_recommendations_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_context_recommendations" ADD CONSTRAINT "repo_context_recommendations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_context_health" ADD CONSTRAINT "run_context_health_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_context_health" ADD CONSTRAINT "run_context_health_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_context_health" ADD CONSTRAINT "run_context_health_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_context_health_repo_id_created_at_idx" ON "run_context_health" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "run_context_health_workspace_id_created_at_idx" ON "run_context_health" USING btree ("workspace_id","created_at");