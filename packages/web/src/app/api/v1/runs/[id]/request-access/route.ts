import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { canViewRun, type Run } from "@glop/shared";
import { sendAccessRequestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: runId } = await params;
    const db = getDb();

    const existing = await db
      .select({ id: schema.access_requests.id })
      .from(schema.access_requests)
      .where(
        and(
          eq(schema.access_requests.run_id, runId),
          eq(schema.access_requests.requester_user_id, session.user_id)
        )
      )
      .limit(1);

    return NextResponse.json({ requested: existing.length > 0 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Check access request error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: runId } = await params;
    const db = getDb();

    // Fetch the run
    const runs = await db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);

    if (runs.length === 0) {
      return NextResponse.json(
        { error: "Run not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const run = runs[0] as unknown as Run;

    // Verify requester doesn't already have access
    const viewerCtx = {
      viewer_user_id: session.user_id,
      viewer_workspace_ids: session.workspaces.map((w) => w.id),
    };

    if (canViewRun(run, viewerCtx)) {
      return NextResponse.json(
        { error: "You already have access to this run", code: "ALREADY_HAS_ACCESS" },
        { status: 400 }
      );
    }

    if (!run.owner_user_id) {
      return NextResponse.json(
        { error: "Run has no owner", code: "NO_OWNER" },
        { status: 400 }
      );
    }

    // Check for existing request
    const existing = await db
      .select({ id: schema.access_requests.id })
      .from(schema.access_requests)
      .where(
        and(
          eq(schema.access_requests.run_id, runId),
          eq(schema.access_requests.requester_user_id, session.user_id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { requested: true, already_requested: true },
        { status: 200 }
      );
    }

    // Insert access request
    await db.insert(schema.access_requests).values({
      run_id: runId,
      requester_user_id: session.user_id,
      owner_user_id: run.owner_user_id,
    });

    // Look up owner email and send notification
    const owners = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, run.owner_user_id))
      .limit(1);

    if (owners.length > 0 && owners[0].email) {
      const baseUrl = request.headers.get("x-forwarded-proto")
        ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
        : new URL(request.url).origin;

      sendAccessRequestEmail({
        to: owners[0].email,
        requesterName: session.name || session.email,
        requesterEmail: session.email,
        sessionTitle: run.title || "Untitled session",
        runUrl: `${baseUrl}/runs/${runId}`,
      });
    }

    return NextResponse.json({ requested: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Request access error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
