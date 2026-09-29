import { createFredProvider } from "./fred";
import { createFxProvider, createCoinGeckoProvider } from "./prices";
import type { EconomicIndicator, PricePoint } from "./types";

export { FRED_SERIES } from "./fred";
export { ECB_SERIES } from "./ecb";

// Which economic indicators matter for each asset (spec Section 6 — the
// engine should identify relevant drivers rather than applying every
// indicator to everything). Each entry maps to a FRED_SERIES key.
export const ASSET_DRIVERS: Record<string, string[]> = {
  "EUR/USD": [
    "us_fed_funds_upper", "us_cpi_index", "us_unemployment", "us_10y_yield",
    "ecb_deposit_rate", "eu_hicp_index", "eu_unemployment",
  ],
  "GBP/USD": ["us_fed_funds_upper", "us_cpi_index", "us_unemployment", "gb_bank_rate"],
  "USD/JPY": ["us_fed_funds_upper", "us_cpi_index", "jp_policy_rate"],
  "XAU/USD": ["us_10y_yield", "us_cpi_index", "us_fed_funds_upper", "gold_price"],
  "BTC/USD": ["us_fed_funds_upper", "us_10y_yield"], // liquidity-sensitive proxies only
};

export interface AssetSnapshot {
  symbol: string;
  fetchedAt: string;
  indicators: EconomicIndicator[];
  failedIndicators: { key: string; error: string }[];
  price: PricePoint | null;
  priceError: string | null;
}

/**
 * Pulls every real indicator relevant to an asset. Failures are collected,
 * not thrown for the whole batch — one bad series shouldn't block the rest
 * (spec Section 49: continue with reduced confidence when possible).
 *
 * Fetches run IN PARALLEL (Promise.allSettled), not one-at-a-time. This
 * matters specifically on serverless hosting: Netlify's free tier caps a
 * synchronous function at 10 seconds, and up to 7 sequential network round
 * trips could plausibly approach that. Running them concurrently — with
 * the per-request timeout already built into fetchJson — keeps total
 * request time close to the single slowest call instead of the sum of all
 * of them.
 */
export async function getAssetSnapshot(symbol: string, fredApiKey: string): Promise<AssetSnapshot> {
  const fred = createFredProvider(fredApiKey);
  const driverKeys = ASSET_DRIVERS[symbol] ?? [];

  const [indicatorSettled, priceSettled] = await Promise.all([
    Promise.allSettled(driverKeys.map((key) => fred.fetchIndicator(key))),
    (async () => {
      const provider = symbol === "BTC/USD" ? createCoinGeckoProvider() : createFxProvider();
      return provider.fetchPrice(symbol);
    })().then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ status: "rejected" as const, reason })
    ),
  ]);

  const indicators: EconomicIndicator[] = [];
  const failedIndicators: { key: string; error: string }[] = [];
  indicatorSettled.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      indicators.push(result.value);
    } else {
      failedIndicators.push({ key: driverKeys[idx], error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
    }
  });

  const price = priceSettled.status === "fulfilled" ? priceSettled.value : null;
  const priceError = priceSettled.status === "rejected" ? (priceSettled.reason instanceof Error ? priceSettled.reason.message : String(priceSettled.reason)) : null;

  return {
    symbol,
    fetchedAt: new Date().toISOString(),
    indicators,
    failedIndicators,
    price,
    priceError,
  };
}
