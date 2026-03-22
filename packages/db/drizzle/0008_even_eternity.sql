CREATE TYPE "public"."claude_item_kind" AS ENUM('skill', 'command');--> statement-breakpoint
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
ALTER TABLE "claude_items" ADD CONSTRAINT "claude_items_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_items" ADD CONSTRAINT "claude_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claude_items_workspace_id_idx" ON "claude_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "claude_items_repo_id_idx" ON "claude_items" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claude_items_repo_kind_name_idx" ON "claude_items" USING btree ("repo_id","kind","name");