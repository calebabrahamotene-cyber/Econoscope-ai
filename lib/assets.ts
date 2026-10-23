export interface AssetMeta {
  symbol: string;
  name: string;
  assetClass: "forex" | "em-fx" | "crypto" | "metal";
  baseLabel?: string; // for forex, human label for the base currency's economy
  quoteLabel?: string;
}

// V1 supported universe with real-data wiring (see lib/providers/index.ts
// ASSET_DRIVERS). Assets without a driver mapping yet will show a
// "not enough live data configured" state rather than fabricated numbers.
export const ASSETS: AssetMeta[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "forex", baseLabel: "Eurozone", quoteLabel: "United States" },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", assetClass: "forex", baseLabel: "United Kingdom", quoteLabel: "United States" },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", assetClass: "forex", baseLabel: "United States", quoteLabel: "Japan" },
  { symbol: "XAU/USD", name: "Gold / US Dollar", assetClass: "metal" },
  { symbol: "BTC/USD", name: "Bitcoin / US Dollar", assetClass: "crypto" },
];

export function getAsset(symbol: string): AssetMeta | undefined {
  return ASSETS.find((a) => a.symbol === decodeURIComponent(symbol));
}

// URL-safe slugs for asset symbols.
//
// Why this exists: asset symbols contain "/" (e.g. "EUR/USD"), and putting
// an encoded slash ("%2F") inside a single Next.js dynamic route segment
// ([symbol]) is a known source of routing bugs — some hosting layers
// normalise or reject it before it reaches your app code, which behaves
// differently locally (next dev/start) than behind a CDN/edge router like
// Netlify's. Using a plain dash instead sidesteps the whole class of bug.
// Every asset symbol here has exactly one slash and no dash of its own, so
// this is safely reversible.
export function toSlug(symbol: string): string {
  return symbol.replace("/", "-");
}
export function fromSlug(slug: string): string {
  return decodeURIComponent(slug).replace("-", "/");
}
