"use client";

import { useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui";

export default function AnalysisDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [outcome, setOutcome] = useState("");
  const [directionCorrect, setDirectionCorrect] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/analyses/${params.id}`);
    setData(await res.json());
  }
  useEffect(() => { load(); }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addNote() {
    if (!noteText.trim()) return;
    setBusy(true);
    await fetch(`/api/analyses/${params.id}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noteText }),
    });
    setNoteText("");
    await load();
    setBusy(false);
  }

  async function submitEvaluation() {
    if (!outcome.trim()) return;
    setBusy(true);
    await fetch(`/api/analyses/${params.id}/evaluate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualOutcome: outcome, directionCorrect: directionCorrect ?? undefined }),
    });
    setOutcome("");
    await load();
    setBusy(false);
  }

  if (!data) return <p className="pt-6 text-sm text-inkSoft">Loading…</p>;
  if (data.error) return <p className="pt-6 text-sm text-bearish">{data.error}</p>;

  const strengths = data.strengths ? JSON.parse(data.strengths) : [];
  const weaknesses = data.weaknesses ? JSON.parse(data.weaknesses) : [];

  return (
    <div className="pt-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold font-mono">{data.asset.symbol}</h1>
          <Badge tone="neutral">{data.method}</Badge>
          {data.classification && <Badge tone={data.score > 8 ? "bull" : data.score < -8 ? "bear" : "neutral"}>{data.classification}</Badge>}
        </div>
        <p className="text-xs text-inkFaint">Saved {new Date(data.createdAt).toLocaleString()}</p>
      </div>

      {(data.score !== null || data.confidence !== null) && (
        <Card>
          <div className="flex gap-6">
            {data.score !== null && <div><div className="text-xs text-inkFaint">Score</div><div className="font-mono text-xl">{data.score > 0 ? "+" : ""}{data.score}</div></div>}
            {data.confidence !== null && <div><div className="text-xs text-inkFaint">Confidence</div><div className="font-mono text-xl">{data.confidence}/100</div></div>}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold mb-2">Summary</h2>
        <p className="text-sm text-inkSoft whitespace-pre-wrap">{data.summary}</p>
      </Card>

      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-xs font-semibold text-bullish mb-2">Strengths</h3>
            <ul className="text-sm text-inkSoft space-y-1 list-disc ml-4">{strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
          </Card>
          <Card>
            <h3 className="text-xs font-semibold text-bearish mb-2">Weaknesses</h3>
            <ul className="text-sm text-inkSoft space-y-1 list-disc ml-4">{weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
          </Card>
        </div>
      )}

      <Card>
        <h2 className="text-sm font-semibold mb-3">Research journal</h2>
        <div className="space-y-2 mb-3">
          {data.notes.map((n: any) => (
            <div key={n.id} className="text-sm bg-surfaceAlt rounded-lg p-2">
              {n.text}
              <div className="text-xs text-inkFaint mt-1">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {data.notes.length === 0 && <p className="text-sm text-inkFaint">No notes yet.</p>}
        </div>
        <div className="flex gap-2">
          <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note…" className="flex-1 border border-border rounded-lg px-3 py-2 text-sm" />
          <button onClick={addNote} disabled={busy} className="text-sm font-semibold px-3 py-2 rounded-lg bg-primary text-white">Add</button>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold mb-3">Evaluation — what actually happened</h2>
        <div className="space-y-2 mb-3">
          {data.evaluations.map((ev: any) => (
            <div key={ev.id} className="text-sm bg-surfaceAlt rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                {ev.directionCorrect === true && <Badge tone="bull">Direction correct</Badge>}
                {ev.directionCorrect === false && <Badge tone="bear">Direction incorrect</Badge>}
                <span className="text-xs text-inkFaint">{new Date(ev.evaluatedAt).toLocaleString()}</span>
              </div>
              {ev.actualOutcome}
            </div>
          ))}
        </div>
        <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3} placeholder="What actually happened since this analysis?"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-2" />
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-1">
            <input type="radio" checked={directionCorrect === true} onChange={() => setDirectionCorrect(true)} /> Direction was correct
          </label>
          <label className="text-sm flex items-center gap-1">
            <input type="radio" checked={directionCorrect === false} onChange={() => setDirectionCorrect(false)} /> Direction was wrong
          </label>
        </div>
        <button onClick={submitEvaluation} disabled={busy} className="mt-3 text-sm font-semibold px-4 py-2 rounded-lg bg-primary text-white">
          Save evaluation
        </button>
      </Card>
    </div>
  );
}
