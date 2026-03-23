CREATE TYPE "public"."suggestion_status" AS ENUM('active', 'accepted', 'dismissed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."suggestion_type" AS ENUM('skill', 'command', 'hook');--> statement-breakpoint
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
ALTER TABLE "standard_suggestions" ADD CONSTRAINT "standard_suggestions_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_suggestions" ADD CONSTRAINT "standard_suggestions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standard_suggestions_repo_status_idx" ON "standard_suggestions" USING btree ("repo_id","status");--> statement-breakpoint
CREATE INDEX "standard_suggestions_workspace_status_idx" ON "standard_suggestions" USING btree ("workspace_id","status");