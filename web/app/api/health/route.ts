import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const mode = process.env.APP_DATA_MODE ?? "synthetic";

  if (mode === "synthetic") {
    return NextResponse.json({ status: "ok", mode, database: "not_checked" });
  }

  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: "ok", mode, database: "ok" });
  } catch {
    return NextResponse.json(
      { status: "degraded", mode, database: "unavailable" },
      { status: 503 },
    );
  }
}
