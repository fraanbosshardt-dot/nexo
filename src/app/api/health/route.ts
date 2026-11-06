import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Chequeo de salud para Railway, Vercel o un monitor externo. No expone datos.
export async function GET() {
  const started = Date.now();
  try {
    await getDb().$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - started });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
