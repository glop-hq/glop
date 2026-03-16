ALTER TYPE "public"."event_type" ADD VALUE 'run.context_compacted' BEFORE 'artifact.added';--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"installation_id" integer NOT NULL,
	"github_account_login" text NOT NULL,
	"github_account_type" text NOT NULL,
	"installed_by" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_installations_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_installed_by_users_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;