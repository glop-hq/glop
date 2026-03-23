CREATE TYPE "public"."coaching_source_type" AS ENUM('repo_insight', 'readiness', 'facet_pattern', 'context_health', 'claude_md', 'standard', 'curated');--> statement-breakpoint
CREATE TYPE "public"."tip_action_type" AS ENUM('copy_to_clipboard', 'open_link', 'dismiss');--> statement-breakpoint
CREATE TYPE "public"."tip_priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."tip_status" AS ENUM('active', 'delivered', 'engaged', 'dismissed', 'expired');--> statement-breakpoint
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
ALTER TABLE "coaching_tips" ADD CONSTRAINT "coaching_tips_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_tips" ADD CONSTRAINT "coaching_tips_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_tips" ADD CONSTRAINT "coaching_tips_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coaching_tips_developer_status_idx" ON "coaching_tips" USING btree ("developer_id","status");--> statement-breakpoint
CREATE INDEX "coaching_tips_repo_status_idx" ON "coaching_tips" USING btree ("repo_id","status");--> statement-breakpoint
CREATE INDEX "coaching_tips_workspace_created_idx" ON "coaching_tips" USING btree ("workspace_id","created_at");