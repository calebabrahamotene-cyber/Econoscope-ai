// Market price providers. Both are free, keyless APIs.
// IMPORTANT: not network-verified from this sandbox — confirm response
// shapes against current provider docs before relying on this in production.

import type { MarketDataProvider, PricePoint } from "./types";
import { fetchJson } from "./http";

// FX: exchangerate.host — https://exchangerate.host/#/docs
export function createFxProvider(): MarketDataProvider {
  return {
    name: "exchangerate.host",
    async fetchPrice(symbol: string): Promise<PricePoint> {
      const [base, quote] = symbol.split("/");
      const url = `https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`;
      const data = await fetchJson<{ rates?: Record<string, number>; date?: string }>(url);
      const rate = data?.rates?.[quote];
      if (typeof rate !== "number") throw new Error(`No rate returned for ${symbol}`);
      return {
        symbol,
        price: rate,
        changePct24h: null, // free tier doesn't include this — leave null rather than fabricate
        asOf: data.date ?? new Date().toISOString(),
        source: "exchangerate.host",
      };
    },
  };
}

// Crypto: CoinGecko public API — https://www.coingecko.com/en/api/documentation
const COINGECKO_IDS: Record<string, string> = {
  "BTC/USD": "bitcoin",
};

export function createCoinGeckoProvider(): MarketDataProvider {
  return {
    name: "coingecko",
    async fetchPrice(symbol: string): Promise<PricePoint> {
      const id = COINGECKO_IDS[symbol];
      if (!id) throw new Error(`No CoinGecko mapping for ${symbol}`);
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`;
      const data = await fetchJson<Record<string, { usd: number; usd_24h_change?: number }>>(url);
      const entry = data?.[id];
      if (!entry) throw new Error(`No CoinGecko data for ${symbol}`);
      return {
        symbol,
        price: entry.usd,
        changePct24h: entry.usd_24h_change ?? null,
        asOf: new Date().toISOString(),
        source: "coingecko",
      };
    },
  };
}
