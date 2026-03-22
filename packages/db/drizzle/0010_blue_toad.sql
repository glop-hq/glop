CREATE TYPE "public"."digest_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."friction_status" AS ENUM('open', 'acknowledged', 'resolved', 'wont_fix');--> statement-breakpoint
CREATE TABLE "digest_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"frequency" "digest_frequency" DEFAULT 'weekly' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friction_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repo_id" uuid,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"frequency" integer NOT NULL,
	"severity" integer NOT NULL,
	"recency_weight" real NOT NULL,
	"impact_score" real NOT NULL,
	"affected_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_action" text,
	"status" "friction_status" DEFAULT 'open' NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "digest_schedules" ADD CONSTRAINT "digest_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_schedules" ADD CONSTRAINT "digest_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friction_insights" ADD CONSTRAINT "friction_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friction_insights" ADD CONSTRAINT "friction_insights_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digest_schedules_user_workspace_idx" ON "digest_schedules" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "friction_insights_workspace_id_idx" ON "friction_insights" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "friction_insights_impact_score_idx" ON "friction_insights" USING btree ("impact_score");--> statement-breakpoint
CREATE INDEX "friction_insights_repo_id_idx" ON "friction_insights" USING btree ("repo_id");