CREATE TYPE "public"."activity_kind" AS ENUM('editing', 'reading', 'test_run', 'build_run', 'check_run', 'git_action', 'deploy_action', 'install_deps', 'web_fetch', 'web_search', 'ask_user', 'plan_mode', 'todo_action', 'skill_invoke', 'docker_action', 'waiting', 'blocked', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('pr', 'preview', 'ci', 'commit');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('run.started', 'run.heartbeat', 'run.phase_changed', 'run.completed', 'run.failed', 'run.prompt', 'run.response', 'run.tool_use', 'run.permission_request', 'run.title_updated', 'run.summary_updated', 'artifact.added', 'artifact.updated');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."run_phase" AS ENUM('editing', 'validating', 'waiting', 'done', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('active', 'blocked', 'stale', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_visibility" AS ENUM('private', 'workspace');--> statement-breakpoint
CREATE TYPE "public"."shared_link_state" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"developer_id" text NOT NULL,
	"developer_name" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
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
	"workspace_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"developer_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"repo_key" text NOT NULL,
	"branch_name" text NOT NULL,
	"session_id" text,
	"slug" text,
	"status" "run_status" DEFAULT 'active' NOT NULL,
	"phase" "run_phase" DEFAULT 'unknown' NOT NULL,
	"activity_kind" "activity_kind" DEFAULT 'unknown' NOT NULL,
	"git_user_name" text,
	"git_user_email" text,
	"title" text,
	"summary" text,
	"current_action" text,
	"last_action_label" text,
	"file_count" integer DEFAULT 0 NOT NULL,
	"files_touched" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visibility" "run_visibility" DEFAULT 'private' NOT NULL,
	"shared_link_state" "shared_link_state",
	"shared_link_expires_at" timestamp with time zone,
	"share_created_at" timestamp with time zone,
	"started_at" timestamp with time zone NOT NULL,
	"last_heartbeat_at" timestamp with time zone NOT NULL,
	"last_event_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"event_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invite_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"token" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invite_links_workspace_id_unique" UNIQUE("workspace_id"),
	CONSTRAINT "workspace_invite_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_run_id_idx" ON "artifacts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "events_run_id_idx" ON "events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "events_occurred_at_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_last_event_at_idx" ON "runs" USING btree ("last_event_at");--> statement-breakpoint
CREATE INDEX "runs_identity_idx" ON "runs" USING btree ("developer_id","machine_id","repo_key","branch_name");--> statement-breakpoint
CREATE INDEX "runs_session_id_idx" ON "runs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "runs_slug_idx" ON "runs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "runs_workspace_id_idx" ON "runs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "runs_owner_user_id_idx" ON "runs" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "runs_visibility_idx" ON "runs" USING btree ("visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_account_idx" ON "users" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_id_idx" ON "workspace_invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invitations_email_status_idx" ON "workspace_invitations" USING btree ("email","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_unique_idx" ON "workspace_members" USING btree ("workspace_id","user_id");