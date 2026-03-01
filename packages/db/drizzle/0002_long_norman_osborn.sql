ALTER TABLE "runs" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE INDEX "runs_slug_idx" ON "runs" USING btree ("slug");