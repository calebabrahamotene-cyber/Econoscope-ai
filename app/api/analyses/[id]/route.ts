import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const analysis = await db.fundamentalAnalysis.findUnique({
    where: { id: params.id },
    include: { asset: true, notes: { orderBy: { createdAt: "asc" } }, evaluations: true, marketSnapshots: true },
  });
  if (!analysis) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(analysis);
}
