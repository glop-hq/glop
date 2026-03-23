import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { mcpSyncSchema } from "@glop/shared/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const db = getDb();
    const auth = await validateApiKey(db, apiKey);

    if (!auth) {
      return NextResponse.json(
        { error: "Invalid API key", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = mcpSyncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { workspace_id, mcps } = parsed.data;

    // Verify user is a member of the workspace
    if (auth.user_id) {
      const membership = await db
        .select({ id: schema.workspace_members.id })
        .from(schema.workspace_members)
        .where(
          and(
            eq(schema.workspace_members.user_id, auth.user_id),
            eq(schema.workspace_members.workspace_id, workspace_id)
          )
        )
        .limit(1);

      if (membership.length === 0) {
        return NextResponse.json(
          { error: "Not a member of this workspace", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    const now = new Date().toISOString();
    let synced = 0;

    for (const mcp of mcps) {
      // Check if this MCP already exists before upserting
      const [existing] = await db
        .select({ id: schema.workspace_mcps.id })
        .from(schema.workspace_mcps)
        .where(
          and(
            eq(schema.workspace_mcps.workspace_id, workspace_id),
            eq(schema.workspace_mcps.canonical_id, mcp.canonical_id)
          )
        )
        .limit(1);

      const isNew = !existing;

      // Upsert workspace_mcps on (workspace_id, canonical_id)
      const [upserted] = await db
        .insert(schema.workspace_mcps)
        .values({
          workspace_id,
          canonical_id: mcp.canonical_id,
          transport: mcp.transport,
          status: "pending",
          first_seen_at: now,
          last_seen_at: now,
        })
        .onConflictDoUpdate({
          target: [
            schema.workspace_mcps.workspace_id,
            schema.workspace_mcps.canonical_id,
          ],
          set: {
            last_seen_at: now,
            updated_at: now,
            transport: mcp.transport,
          },
        })
        .returning({ id: schema.workspace_mcps.id });

      // Upsert alias
      await db
        .insert(schema.mcp_aliases)
        .values({
          workspace_mcp_id: upserted.id,
          alias: mcp.server_name,
        })
        .onConflictDoNothing();

      if (isNew) {
        await db.insert(schema.mcp_alerts).values({
          workspace_id,
          workspace_mcp_id: upserted.id,
          alert_type: "new_mcp_discovered",
          severity: "info",
          title: `New MCP discovered: "${mcp.server_name}"`,
          detail: `MCP "${mcp.server_name}" (${mcp.canonical_id}) was detected from config sync.`,
          context: {
            canonical_id: mcp.canonical_id,
            transport: mcp.transport,
            source: "config_sync",
          },
        });
      }

      synced++;
    }

    return NextResponse.json({ synced }, { status: 200 });
  } catch (error) {
    console.error("MCP sync error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
