// Modular provider contracts (spec Section 45).
// Every real data source implements one of these. Swapping FRED for another
// economic-data vendor, or exchangerate.host for a paid FX feed, means
// writing a new file that satisfies this interface — nothing else changes.

export interface EconomicIndicator {
  source: string; // "FRED" | "ECB-SDW"
  indicator: string; // internal key, e.g. "us_fed_funds_upper"
  label: string; // human-readable
  value: number;
  unit: string;
  observationDate: string; // ISO date the data point refers to
  raw?: unknown;
}

export interface EconomicDataProvider {
  name: string;
  /** Fetch one named indicator. Throws on failure — callers must catch and
   *  degrade gracefully (spec Section 49: never fabricate on failure). */
  fetchIndicator(key: string): Promise<EconomicIndicator>;
}

export interface PricePoint {
  symbol: string;
  price: number;
  changePct24h: number | null;
  asOf: string;
  source: string;
}

export interface MarketDataProvider {
  name: string;
  fetchPrice(symbol: string): Promise<PricePoint>;
}
