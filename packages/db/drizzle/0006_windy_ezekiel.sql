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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "developer_entity_id" uuid;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "repo_id" uuid;--> statement-breakpoint
ALTER TABLE "developers" ADD CONSTRAINT "developers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "developers_workspace_id_idx" ON "developers" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "developers_workspace_email_idx" ON "developers" USING btree ("workspace_id","email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE INDEX "repos_workspace_id_idx" ON "repos" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_workspace_repo_key_idx" ON "repos" USING btree ("workspace_id","repo_key");--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_developer_entity_id_developers_id_fk" FOREIGN KEY ("developer_entity_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_developer_entity_id_idx" ON "runs" USING btree ("developer_entity_id");--> statement-breakpoint
CREATE INDEX "runs_repo_id_idx" ON "runs" USING btree ("repo_id");