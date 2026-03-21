CREATE TYPE "public"."check_status" AS ENUM('pass', 'warn', 'fail', 'skip');--> statement-breakpoint
CREATE TYPE "public"."scan_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'completed', 'error');--> statement-breakpoint
CREATE TABLE "repo_scan_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"check_id" text NOT NULL,
	"status" "check_status" NOT NULL,
	"severity" "scan_severity" NOT NULL,
	"weight" integer NOT NULL,
	"score" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recommendation" text,
	"fix_available" boolean DEFAULT false NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"score" integer,
	"status" "scan_status" DEFAULT 'pending' NOT NULL,
	"triggered_by" text NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "last_scanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repo_scan_checks" ADD CONSTRAINT "repo_scan_checks_scan_id_repo_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."repo_scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_scans" ADD CONSTRAINT "repo_scans_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_scans" ADD CONSTRAINT "repo_scans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repo_scan_checks_scan_id_idx" ON "repo_scan_checks" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "repo_scans_repo_id_idx" ON "repo_scans" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "repo_scans_repo_id_created_at_idx" ON "repo_scans" USING btree ("repo_id","created_at");