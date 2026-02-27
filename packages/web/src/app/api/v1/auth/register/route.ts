import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { registerDeveloper } from "@/lib/auth";
import { authRegisterSchema } from "@glop/shared";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = authRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const db = getDb();
    const result = await registerDeveloper(db, parsed.data.developer_name);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
