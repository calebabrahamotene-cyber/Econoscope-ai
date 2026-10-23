"use client";

import { useEffect, useState } from "react";
import { fromSlug, toSlug } from "@/lib/assets";
import { Card, Badge } from "@/components/ui";

interface Indicator {
  source: string;
  indicator: string;
  label: string;
  value: number;
  unit: string;
  observationDate: string;
}
interface Snapshot {
  asset: { symbol: string; name: string; assetClass: string };
  fetchedAt: string;
  indicators: Indicator[];
  failedIndicators: { key: string; error: string }[];
  price: { price: number; changePct24h: number | null; asOf: string; source: string } | null;
  priceError: string | null;
}

export default function AssetPage({ params }: { params: { symbol: string } }) {
  const slug = params.symbol; // e.g. "EUR-USD" — URL-safe form, see lib/assets.ts
  const symbol = fromSlug(slug); // e.g. "EUR/USD" — real symbol, for display and API payloads
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<any>(null);

  async function loadLiveData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data/${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function computeScore() {
    setScoring(true);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "rule-based", symbol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scoring failed");
      setScoreResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScoring(false);
    }
  }

  useEffect(() => {
    loadLiveData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return (
    <div className="pt-6">
      <h1 className="text-2xl font-bold font-mono mb-1">{symbol}</h1>
      <p className="text-sm text-inkFaint mb-6">Live data pulled directly from FRED / ECB SDW and a real price feed.</p>

      {loading && <p className="text-sm text-inkSoft">Fetching live data…</p>}
      {error && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-bearish">{error}</p>
        </Card>
      )}

      {snapshot && (
        <>
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Price</span>
              <span className="text-xs text-inkFaint">as of {snapshot.price?.asOf ?? "—"}</span>
            </div>
            {snapshot.price ? (
              <div className="text-2xl font-mono">{snapshot.price.price} <span className="text-sm text-inkFaint">({snapshot.price.source})</span></div>
            ) : (
              <p className="text-sm text-amber">Price unavailable: {snapshot.priceError}</p>
            )}
          </Card>

          <Card className="mb-4">
            <h2 className="text-sm font-semibold mb-3">Live economic indicators ({snapshot.indicators.length})</h2>
            <div className="space-y-2">
              {snapshot.indicators.map((i) => (
                <div key={i.indicator} className="flex items-center justify-between text-sm border-b border-border pb-2">
                  <div>
                    <div className="font-medium">{i.label}</div>
                    <div className="text-xs text-inkFaint">{i.source} · as of {i.observationDate}</div>
                  </div>
                  <div className="font-mono">{i.value} {i.unit}</div>
                </div>
              ))}
              {snapshot.indicators.length === 0 && <p className="text-sm text-inkFaint">No indicators returned.</p>}
            </div>
            {snapshot.failedIndicators.length > 0 && (
              <div className="mt-3 text-xs text-amber">
                {snapshot.failedIndicators.length} indicator(s) failed to load — data unavailable, not fabricated:
                <ul className="list-disc ml-4 mt-1">
                  {snapshot.failedIndicators.map((f) => <li key={f.key}>{f.key}: {f.error}</li>)}
                </ul>
              </div>
            )}
          </Card>

          <div className="flex gap-3 mb-6">
            <button onClick={computeScore} disabled={scoring} className="text-sm font-semibold px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50">
              {scoring ? "Scoring…" : "Compute rule-based score"}
            </button>
            <a href={`/analysis/new?symbol=${encodeURIComponent(symbol)}`} className="text-sm font-semibold px-4 py-2 rounded-lg border border-primary text-primary">
              Import a reasoned report
            </a>
          </div>

          {scoreResult && (
            <Card className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Badge tone={scoreResult.analysis.score > 8 ? "bull" : scoreResult.analysis.score < -8 ? "bear" : "neutral"}>
                  {scoreResult.analysis.classification}
                </Badge>
                <span className="font-mono text-sm">{scoreResult.analysis.score > 0 ? "+" : ""}{scoreResult.analysis.score} · confidence {scoreResult.analysis.confidence}/100</span>
              </div>
              <div className="space-y-2 text-sm">
                {scoreResult.scoringDetail.breakdown.map((b: any) => (
                  <div key={b.indicator} className="border-b border-border pb-2">
                    <div className="flex justify-between font-medium">
                      <span>{b.label}</span>
                      <span className="font-mono">{b.contribution > 0 ? "+" : ""}{b.contribution.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-inkFaint">{b.rationale}</p>
                  </div>
                ))}
              </div>
              <a href={`/analysis/${scoreResult.analysis.id}`} className="inline-block mt-3 text-sm text-primary font-medium">
                Open saved analysis →
              </a>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
