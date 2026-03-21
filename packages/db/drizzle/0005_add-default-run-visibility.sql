ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "default_run_visibility" "run_visibility" DEFAULT 'workspace' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "workspace_id";