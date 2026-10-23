"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ASSETS } from "@/lib/assets";
import { Card } from "@/components/ui";

function NewReasonedAnalysisForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [symbol, setSymbol] = useState(params.get("symbol") ?? ASSETS[0].symbol);
  const [summary, setSummary] = useState("");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [score, setScore] = useState("");
  const [confidence, setConfidence] = useState("");
  const [classification, setClassification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "reasoned-import",
          symbol,
          summary,
          strengths: strengths.split("\n").map((s) => s.trim()).filter(Boolean),
          weaknesses: weaknesses.split("\n").map((s) => s.trim()).filter(Boolean),
          score: score ? Number(score) : undefined,
          confidence: confidence ? Number(confidence) : undefined,
          classification: classification || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      router.push(`/analysis/${data.analysis.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-6">
      <h1 className="text-xl font-bold mb-1">Import a reasoned report</h1>
      <p className="text-sm text-inkSoft mb-6">
        Paste in a fundamental analysis produced from real, current research — e.g. from a chat session where an
        assistant used live web search to check current rates, inflation, and news. This is the human-in-the-loop
        step: the qualitative judgment (the debate, the "why", the divergence explanation) isn't something the
        rule-based engine can produce, so it's saved here instead of faked.
      </p>

      <Card className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-inkSoft block mb-1">Asset</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm">
            {ASSETS.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-inkSoft block mb-1">Summary / full narrative *</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={8}
            placeholder="Paste the full reasoned analysis here — structural/recent/current picture, the debate, catalysts, whatever you have."
            className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-inkSoft block mb-1">Score (-100 to 100)</label>
            <input value={score} onChange={(e) => setScore(e.target.value)} type="number" min={-100} max={100}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-inkSoft block mb-1">Confidence (0-100)</label>
            <input value={confidence} onChange={(e) => setConfidence(e.target.value)} type="number" min={0} max={100}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-inkSoft block mb-1">Classification</label>
            <input value={classification} onChange={(e) => setClassification(e.target.value)} placeholder="e.g. Moderately Bullish"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-inkSoft block mb-1">Strengths (one per line)</label>
          <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-inkSoft block mb-1">Weaknesses (one per line)</label>
          <textarea value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
        </div>

        {error && <p className="text-sm text-bearish">{error}</p>}

        <button onClick={submit} disabled={submitting || summary.length < 20}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50">
          {submitting ? "Saving…" : "Save analysis"}
        </button>
      </Card>
    </div>
  );
}

// useSearchParams() must sit inside a Suspense boundary or `next build`
// fails on Netlify ("missing-suspense-with-csr-bailout").
export default function NewReasonedAnalysis() {
  return (
    <Suspense fallback={<p className="pt-6 text-sm text-inkSoft">Loading…</p>}>
      <NewReasonedAnalysisForm />
    </Suspense>
  );
}
