import { ASSETS, toSlug } from "@/lib/assets";
import { Card, Badge } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="pt-6">
      <h1 className="text-3xl font-bold text-primaryDark mb-1">EconoScope AI</h1>
      <p className="text-inkSoft mb-8">See the Economy. Understand the Market.</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-10">
        {ASSETS.map((a) => (
          <a key={a.symbol} href={`/asset/${toSlug(a.symbol)}`}>
            <Card className="hover:border-primary transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold">{a.symbol}</span>
                <Badge>{a.assetClass}</Badge>
              </div>
              <p className="text-sm text-inkSoft mt-1">{a.name}</p>
            </Card>
          </a>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold mb-2">How this works</h2>
        <ol className="text-sm text-inkSoft list-decimal ml-4 space-y-1">
          <li>Open an asset to pull live economic data from FRED / ECB SDW and a live price.</li>
          <li>Optionally compute a transparent rule-based score from that real data.</li>
          <li>
            For real qualitative reasoning — the debate, historical analogues, divergence explanation — do that
            research in a chat session with live search, then use{" "}
            <a href="/analysis/new" className="text-primary font-medium">Import Reasoned Report</a> to save it here.
          </li>
          <li>Come back later and log what actually happened in the Evaluation tab of any saved analysis.</li>
        </ol>
      </Card>
    </div>
  );
}
