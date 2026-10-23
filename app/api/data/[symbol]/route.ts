import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAsset, fromSlug } from "@/lib/assets";
import { getAssetSnapshot } from "@/lib/providers";

// Force this to run fresh on every request. Without this, Next.js may
// statically cache a GET route handler's response — which would silently
// defeat the entire point of an app whose value proposition is "current
// data." Netlify's build step doesn't have a FRED key or DB connection
// available anyway, so this also avoids a bad cached response from the
// build itself.
export const dynamic = "force-dynamic";
// Prisma requires the Node.js runtime, not the Edge runtime.
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { symbol: string } }) {
  const realSymbol = fromSlug(params.symbol); // params.symbol arrives as "EUR-USD"
  const meta = getAsset(realSymbol);
  if (!meta) {
    return NextResponse.json({ error: `Unsupported or unconfigured asset: ${realSymbol}` }, { status: 404 });
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FRED_API_KEY is not set. Add it in your environment variables — see .env.example." },
      { status: 500 }
    );
  }

  let snapshot;
  try {
    snapshot = await getAssetSnapshot(meta.symbol, apiKey);
  } catch (err) {
    // Should be rare — getAssetSnapshot already catches per-indicator
    // failures internally — but never let an unexpected error surface as
    // an unhandled 500 with no explanation.
    return NextResponse.json(
      { error: `Failed to fetch live data: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  // Persist the asset row (idempotent) and every real indicator we got back.
  // If the database is unreachable, still return the live data we fetched —
  // a DB hiccup shouldn't hide real, already-fetched numbers from the user.
  try {
    const asset = await db.asset.upsert({
      where: { symbol: meta.symbol },
      update: {},
      create: { symbol: meta.symbol, name: meta.name, assetClass: meta.assetClass },
    });

    if (snapshot.indicators.length > 0) {
      await db.dataSnapshot.createMany({
        data: snapshot.indicators.map((i) => ({
          assetId: asset.id,
          source: i.source,
          indicator: i.indicator,
          label: i.label,
          value: i.value,
          unit: i.unit,
          observationDate: new Date(i.observationDate),
          raw: i.raw ? JSON.stringify(i.raw) : null,
        })),
      });
    }
  } catch (err) {
    return NextResponse.json({
      asset: meta,
      ...snapshot,
      persistWarning: `Live data fetched successfully but could not be saved: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return NextResponse.json({ asset: meta, ...snapshot });
}
