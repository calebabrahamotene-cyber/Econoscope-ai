import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAsset } from "@/lib/assets";
import { getAssetSnapshot } from "@/lib/providers";
import { scoreForexPair } from "@/lib/scoring/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const analyses = await db.fundamentalAnalysis.findMany({
    orderBy: { createdAt: "desc" },
    include: { asset: true, notes: true, evaluations: true },
  });
  return NextResponse.json(analyses);
}

// Two request shapes, discriminated by `method`:
//   { method: "rule-based", symbol }
//     -> pulls live data now and computes a deterministic score.
//   { method: "reasoned-import", symbol, summary, score?, confidence?,
//     classification?, strengths?, weaknesses?, sourcesUsed? }
//     -> stores a narrative produced by real research done elsewhere
//        (e.g. a chat session with live web search), per the project's
//        human-in-the-loop hybrid design.
const ruleBasedSchema = z.object({ method: z.literal("rule-based"), symbol: z.string() });
const reasonedImportSchema = z.object({
  method: z.literal("reasoned-import"),
  symbol: z.string(),
  summary: z.string().min(20),
  score: z.number().min(-100).max(100).optional(),
  confidence: z.number().min(0).max(100).optional(),
  classification: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  sourcesUsed: z.array(z.object({ label: z.string(), url: z.string().optional() })).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.method === "rule-based") {
    const parsed = ruleBasedSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const meta = getAsset(parsed.data.symbol);
    const apiKey = process.env.FRED_API_KEY;
    if (!meta) return NextResponse.json({ error: "Unsupported asset" }, { status: 404 });
    if (!apiKey) return NextResponse.json({ error: "FRED_API_KEY is not set" }, { status: 500 });
    if (meta.assetClass !== "forex") {
      return NextResponse.json(
        { error: "Rule-based scoring is currently only implemented for FX pairs. Use a reasoned-import for other asset classes." },
        { status: 400 }
      );
    }

    const snapshot = await getAssetSnapshot(meta.symbol, apiKey);
    // naive split: FRED indicators are pre-tagged by which economy they
    // describe via key prefix (us_/eu_/ecb_/jp_/gb_) — good enough for V1.
    const [baseCcy] = meta.symbol.split("/");
    const baseIndicators = snapshot.indicators.filter((i) =>
      baseCcy === "EUR" ? i.indicator.startsWith("eu_") || i.indicator.startsWith("ecb_") : i.indicator.startsWith("us_")
    );
    const quoteIndicators = snapshot.indicators.filter((i) => !baseIndicators.includes(i));

    const result = scoreForexPair(baseIndicators, quoteIndicators, meta.baseLabel ?? baseCcy, meta.quoteLabel ?? "quote currency");

    const asset = await db.asset.upsert({
      where: { symbol: meta.symbol },
      update: {},
      create: { symbol: meta.symbol, name: meta.name, assetClass: meta.assetClass },
    });

    const analysis = await db.fundamentalAnalysis.create({
      data: {
        assetId: asset.id,
        method: "rule-based",
        score: result.score,
        confidence: result.confidence,
        classification: result.classification,
        summary: `Rule-based score computed from ${result.breakdown.length} live indicator(s). Missing: ${result.missingData.join(", ") || "none"}.`,
        strengths: JSON.stringify(result.breakdown.filter((b) => b.contribution > 0).map((b) => b.rationale)),
        weaknesses: JSON.stringify(result.breakdown.filter((b) => b.contribution < 0).map((b) => b.rationale)),
        sourcesUsed: JSON.stringify(snapshot.indicators.map((i) => ({ label: i.label, source: i.source, value: i.value, date: i.observationDate }))),
      },
    });

    if (snapshot.price) {
      await db.marketSnapshot.create({
        data: {
          analysisId: analysis.id,
          price: snapshot.price.price,
          changePct24h: snapshot.price.changePct24h,
          source: snapshot.price.source,
        },
      });
    }

    return NextResponse.json({ analysis, scoringDetail: result });
  }

  if (body.method === "reasoned-import") {
    const parsed = reasonedImportSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const meta = getAsset(parsed.data.symbol);
    if (!meta) return NextResponse.json({ error: "Unsupported asset" }, { status: 404 });

    const asset = await db.asset.upsert({
      where: { symbol: meta.symbol },
      update: {},
      create: { symbol: meta.symbol, name: meta.name, assetClass: meta.assetClass },
    });

    const analysis = await db.fundamentalAnalysis.create({
      data: {
        assetId: asset.id,
        method: "reasoned-import",
        score: parsed.data.score ?? null,
        confidence: parsed.data.confidence ?? null,
        classification: parsed.data.classification ?? null,
        summary: parsed.data.summary,
        strengths: parsed.data.strengths ? JSON.stringify(parsed.data.strengths) : null,
        weaknesses: parsed.data.weaknesses ? JSON.stringify(parsed.data.weaknesses) : null,
        sourcesUsed: parsed.data.sourcesUsed ? JSON.stringify(parsed.data.sourcesUsed) : null,
      },
    });

    return NextResponse.json({ analysis });
  }

  return NextResponse.json({ error: "method must be 'rule-based' or 'reasoned-import'" }, { status: 400 });
}
