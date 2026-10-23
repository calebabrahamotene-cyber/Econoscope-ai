"use client";

import { useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui";

export default function HistoryPage() {
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/analyses").then((r) => r.json()).then(setList);
  }, []);

  return (
    <div className="pt-6">
      <h1 className="text-xl font-bold mb-4">History</h1>
      <div className="space-y-3">
        {list.map((a) => (
          <a key={a.id} href={`/analysis/${a.id}`}>
            <Card className="hover:border-primary transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{a.asset.symbol}</span>
                  <Badge tone="neutral">{a.method}</Badge>
                  {a.classification && <Badge tone={a.score > 8 ? "bull" : a.score < -8 ? "bear" : "neutral"}>{a.classification}</Badge>}
                </div>
                <span className="text-xs text-inkFaint">{new Date(a.createdAt).toLocaleDateString()}</span>
              </div>
            </Card>
          </a>
        ))}
        {list.length === 0 && <p className="text-sm text-inkFaint">Nothing saved yet.</p>}
      </div>
    </div>
  );
}
