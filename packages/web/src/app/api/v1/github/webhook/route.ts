import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getWebhookSecret } from "@/lib/github-app";

export const dynamic = "force-dynamic";

function verifySignature(payload: string, signature: string): boolean {
  const secret = getWebhookSecret();
  if (!secret) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") || "";
  const payload = JSON.parse(body) as Record<string, unknown>;

  if (event === "installation" && payload.action === "deleted") {
    const installationId = (payload.installation as Record<string, unknown>)
      ?.id as number;
    if (installationId) {
      const db = getDb();
      await db
        .update(schema.github_installations)
        .set({ enabled: false, updated_at: new Date().toISOString() })
        .where(eq(schema.github_installations.installation_id, installationId));
    }
  }

  return NextResponse.json({ ok: true });
}
