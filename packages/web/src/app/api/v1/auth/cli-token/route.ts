import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { registerDeveloper } from "@/lib/auth";
import { requireSession, AuthError } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const callbackPort = body.callback_port;

    if (!callbackPort || typeof callbackPort !== "number") {
      return NextResponse.json(
        { error: "Missing callback_port", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const db = getDb();
    const result = await registerDeveloper(
      db,
      session.name || session.email,
      session.user_id
    );

    const params = new URLSearchParams({
      api_key: result.api_key,
      developer_id: result.developer_id,
      developer_name: session.name || session.email,
    });

    const redirectUrl = `http://127.0.0.1:${callbackPort}/callback?${params}`;

    return NextResponse.json({ redirect_url: redirectUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("CLI token error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
