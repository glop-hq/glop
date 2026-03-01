import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ status: "ok" });
  }

  const db = getDb();
  const auth = await validateApiKey(db, token);

  if (!auth) {
    return NextResponse.json(
      { error: "Invalid API key", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  return NextResponse.json({ status: "ok", developer: auth.developer_name });
}
