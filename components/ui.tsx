export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface border border-border p-5 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "bull" | "bear" | "neutral" | "amber" }) {
  const map: Record<string, string> = {
    bull: "bg-green-50 text-bullish",
    bear: "bg-red-50 text-bearish",
    neutral: "bg-surfaceAlt text-inkSoft",
    amber: "bg-amber-50 text-amber",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

export function toneOf(score: number | null | undefined) {
  if (score === null || score === undefined) return "neutral" as const;
  if (score > 8) return "bull" as const;
  if (score < -8) return "bear" as const;
  return "neutral" as const;
}
