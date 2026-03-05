DROP INDEX "runs_shared_link_id_idx";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "shared_link_id";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "shared_link_token";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "shared_link_token_hash";