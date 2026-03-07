ALTER TABLE "runs" ADD COLUMN "parent_run_id" uuid;--> statement-breakpoint
CREATE INDEX "runs_parent_run_id_idx" ON "runs" USING btree ("parent_run_id");