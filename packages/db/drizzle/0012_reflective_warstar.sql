DROP INDEX "run_mcp_usage_run_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "run_mcp_usage_run_id_mcp_server_idx" ON "run_mcp_usage" USING btree ("run_id","mcp_server");