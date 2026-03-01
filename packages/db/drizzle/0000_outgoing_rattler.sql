CREATE TYPE "public"."activity_kind" AS ENUM('editing', 'reading', 'test_run', 'build_run', 'check_run', 'git_action', 'deploy_action', 'install_deps', 'web_fetch', 'web_search', 'ask_user', 'plan_mode', 'todo_action', 'skill_invoke', 'docker_action', 'waiting', 'blocked', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('pr', 'preview', 'ci', 'commit');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('run.started', 'run.heartbeat', 'run.phase_changed', 'run.completed', 'run.failed', 'run.prompt', 'run.response', 'run.tool_use', 'run.permission_request', 'run.title_updated', 'run.summary_updated', 'artifact.added', 'artifact.updated');--> statement-breakpoint
CREATE TYPE "public"."run_phase" AS ENUM('editing', 'validating', 'waiting', 'done', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('active', 'blocked', 'stale', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"developer_id" text NOT NULL,
	"developer_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"artifact_type" "artifact_type" NOT NULL,
	"url" text,
	"label" text,
	"external_id" text,
	"state" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" "event_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"run_id" uuid NOT NULL,
	"developer_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"repo_key" text NOT NULL,
	"branch_name" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"developer_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"repo_key" text NOT NULL,
	"branch_name" text NOT NULL,
	"session_id" text,
	"status" "run_status" DEFAULT 'active' NOT NULL,
	"phase" "run_phase" DEFAULT 'unknown' NOT NULL,
	"activity_kind" "activity_kind" DEFAULT 'unknown' NOT NULL,
	"title" text,
	"summary" text,
	"current_action" text,
	"last_action_label" text,
	"file_count" integer DEFAULT 0 NOT NULL,
	"files_touched" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_heartbeat_at" timestamp with time zone NOT NULL,
	"last_event_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"event_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_run_id_idx" ON "artifacts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "events_run_id_idx" ON "events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "events_occurred_at_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_last_event_at_idx" ON "runs" USING btree ("last_event_at");--> statement-breakpoint
CREATE INDEX "runs_identity_idx" ON "runs" USING btree ("developer_id","machine_id","repo_key","branch_name");--> statement-breakpoint
CREATE INDEX "runs_session_id_idx" ON "runs" USING btree ("session_id");