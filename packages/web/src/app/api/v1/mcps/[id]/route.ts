import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { mcpStatusUpdateSchema } from "@glop/shared/validation";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  isWorkspaceAdmin,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type { AnalyticsPeriod } from "@glop/shared";

export const dynamic = "force-dynamic";

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const sp = request.nextUrl.searchParams;
    const workspaceId = sp.get("workspace_id");
    const period = (sp.get("period") ?? "30d") as AnalyticsPeriod;

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    requireWorkspaceMember(session, workspaceId);

    const db = getDb();
    const days = PERIOD_DAYS[period] ?? 30;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    const periodStartStr = periodStart.toISOString();

    // Fetch MCP
    const [mcp] = await db
      .select()
      .from(schema.workspace_mcps)
      .where(
        and(
          eq(schema.workspace_mcps.id, id),
          eq(schema.workspace_mcps.workspace_id, workspaceId)
        )
      )
      .limit(1);

    if (!mcp) {
      return NextResponse.json(
        { error: "MCP not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Fetch tools, aliases, usage timeline, repos, developers in parallel
    const [tools, aliases, usageTimeline, repos, developers] =
      await Promise.all([
        db
          .select()
          .from(schema.mcp_tools)
          .where(eq(schema.mcp_tools.workspace_mcp_id, id)),
        db
          .select({ alias: schema.mcp_aliases.alias })
          .from(schema.mcp_aliases)
          .where(eq(schema.mcp_aliases.workspace_mcp_id, id)),
        db
          .select({
            date: sql<string>`date_trunc('day', ${schema.mcp_usage.occurred_at})::date::text`,
            calls: sql<number>`count(*)::int`,
            errors: sql<number>`count(*) FILTER (WHERE ${schema.mcp_usage.is_error})::int`,
          })
          .from(schema.mcp_usage)
          .where(
            and(
              eq(schema.mcp_usage.workspace_mcp_id, id),
              sql`${schema.mcp_usage.occurred_at} >= ${periodStartStr}`
            )
          )
          .groupBy(sql`date_trunc('day', ${schema.mcp_usage.occurred_at})`)
          .orderBy(sql`date_trunc('day', ${schema.mcp_usage.occurred_at})`),
        db
          .select({
            repo_id: schema.mcp_usage.repo_id,
            repo_key: schema.repos.repo_key,
            call_count: sql<number>`count(*)::int`,
          })
          .from(schema.mcp_usage)
          .leftJoin(schema.repos, eq(schema.mcp_usage.repo_id, schema.repos.id))
          .where(
            and(
              eq(schema.mcp_usage.workspace_mcp_id, id),
              sql`${schema.mcp_usage.occurred_at} >= ${periodStartStr}`,
              sql`${schema.mcp_usage.repo_id} IS NOT NULL`
            )
          )
          .groupBy(schema.mcp_usage.repo_id, schema.repos.repo_key)
          .orderBy(sql`count(*) DESC`),
        db
          .select({
            developer_id: schema.mcp_usage.developer_entity_id,
            display_name: schema.developers.display_name,
            call_count: sql<number>`count(*)::int`,
          })
          .from(schema.mcp_usage)
          .leftJoin(
            schema.developers,
            eq(schema.mcp_usage.developer_entity_id, schema.developers.id)
          )
          .where(
            and(
              eq(schema.mcp_usage.workspace_mcp_id, id),
              sql`${schema.mcp_usage.occurred_at} >= ${periodStartStr}`,
              sql`${schema.mcp_usage.developer_entity_id} IS NOT NULL`
            )
          )
          .groupBy(
            schema.mcp_usage.developer_entity_id,
            schema.developers.display_name
          )
          .orderBy(sql`count(*) DESC`),
      ]);

    const usageCount = usageTimeline.reduce((s, r) => s + Number(r.calls), 0);
    const errorCount = usageTimeline.reduce(
      (s, r) => s + Number(r.errors),
      0
    );

    return NextResponse.json({
      mcp: {
        id: mcp.id,
        canonical_id: mcp.canonical_id,
        transport: mcp.transport,
        display_name: mcp.display_name,
        description: mcp.description,
        status: mcp.status,
        setup_guidance: mcp.setup_guidance,
        status_note: mcp.status_note,
        aliases: aliases.map((a) => a.alias),
        tools: tools.map((t) => ({
          id: t.id,
          tool_name: t.tool_name,
          call_count: t.call_count,
          error_count: t.error_count,
          first_seen_at: t.first_seen_at,
          last_seen_at: t.last_seen_at,
        })),
        usage_count: usageCount,
        error_count: errorCount,
        repo_count: repos.length,
        developer_count: developers.length,
        first_seen_at: mcp.first_seen_at,
        last_seen_at: mcp.last_seen_at,
      },
      usage_timeline: usageTimeline.map((r) => ({
        date: r.date,
        calls: Number(r.calls),
        errors: Number(r.errors),
      })),
      repos: repos.map((r) => ({
        repo_id: r.repo_id!,
        repo_key: r.repo_key ?? "unknown",
        call_count: Number(r.call_count),
      })),
      developers: developers.map((d) => ({
        developer_id: d.developer_id!,
        display_name: d.display_name,
        call_count: Number(d.call_count),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json(
        { error: error.message, code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    console.error("MCP detail error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const body = await request.json();
    const parsed = mcpStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { workspace_id, status, display_name, description, setup_guidance, status_note } =
      parsed.data;

    requireWorkspaceMember(session, workspace_id);
    if (!isWorkspaceAdmin(session, workspace_id)) {
      return NextResponse.json(
        { error: "Admin role required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      status,
      status_changed_at: now,
      status_changed_by: session.email,
      updated_at: now,
    };
    if (display_name !== undefined) updateData.display_name = display_name;
    if (description !== undefined) updateData.description = description;
    if (setup_guidance !== undefined) updateData.setup_guidance = setup_guidance;
    if (status_note !== undefined) updateData.status_note = status_note;

    const [updated] = await db
      .update(schema.workspace_mcps)
      .set(updateData)
      .where(
        and(
          eq(schema.workspace_mcps.id, id),
          eq(schema.workspace_mcps.workspace_id, workspace_id)
        )
      )
      .returning({ id: schema.workspace_mcps.id });

    if (!updated) {
      return NextResponse.json(
        { error: "MCP not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: updated.id, status });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json(
        { error: error.message, code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    console.error("MCP update error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
