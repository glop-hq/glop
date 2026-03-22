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
ALTER TABLE "repo_insights" ADD CONSTRAINT "repo_insights_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_insights" ADD CONSTRAINT "repo_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_facets" ADD CONSTRAINT "session_facets_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_facets" ADD CONSTRAINT "session_facets_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_facets" ADD CONSTRAINT "session_facets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_facets" ADD CONSTRAINT "session_facets_developer_entity_id_developers_id_fk" FOREIGN KEY ("developer_entity_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repo_insights_repo_id_created_at_idx" ON "repo_insights" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "repo_insights_workspace_id_idx" ON "repo_insights" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "session_facets_repo_id_created_at_idx" ON "session_facets" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "session_facets_workspace_id_created_at_idx" ON "session_facets" USING btree ("workspace_id","created_at");