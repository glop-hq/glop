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
ALTER TABLE "claude_md_directives" ADD CONSTRAINT "claude_md_directives_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_md_directives" ADD CONSTRAINT "claude_md_directives_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_mcp_usage" ADD CONSTRAINT "run_mcp_usage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_mcp_usage" ADD CONSTRAINT "run_mcp_usage_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_mcp_usage" ADD CONSTRAINT "run_mcp_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claude_md_directives_repo_id_idx" ON "claude_md_directives" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "claude_md_directives_workspace_id_idx" ON "claude_md_directives" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "run_mcp_usage_repo_id_mcp_server_idx" ON "run_mcp_usage" USING btree ("repo_id","mcp_server");--> statement-breakpoint
CREATE INDEX "run_mcp_usage_run_id_idx" ON "run_mcp_usage" USING btree ("run_id");