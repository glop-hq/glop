ALTER TABLE "public"."runs" ALTER COLUMN "visibility" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."run_visibility";--> statement-breakpoint
CREATE TYPE "public"."run_visibility" AS ENUM('private', 'workspace');--> statement-breakpoint
ALTER TABLE "public"."runs" ALTER COLUMN "visibility" SET DATA TYPE "public"."run_visibility" USING "visibility"::"public"."run_visibility";