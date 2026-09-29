// Federal Reserve Economic Data (FRED) provider.
// Free API, instant key: https://fred.stlouisfed.org/docs/api/api_key.html
// Docs: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
//
// IMPORTANT — could not be network-verified in the environment this file
// was written in. The series IDs below are FRED's documented codes for
// these exact series as of this project's writing, but FRED occasionally
// revises or discontinues series. Before relying on this in production,
// open each series page on fred.stlouisfed.org and confirm the ID still
// resolves. This is exactly the kind of failure Section 49 of the spec
// asks the app to handle gracefully rather than hide — see fetchIndicator
// below, which throws rather than fabricating a value on a bad response.

import type { EconomicDataProvider, EconomicIndicator } from "./types";
import { fetchJson } from "./http";

// key -> { series id, human label, unit }
export const FRED_SERIES: Record<string, { id: string; label: string; unit: string }> = {
  us_fed_funds_upper: { id: "DFEDTARU", label: "US Federal Funds Target Rate (upper bound)", unit: "%" },
  us_fed_funds_lower: { id: "DFEDTARL", label: "US Federal Funds Target Rate (lower bound)", unit: "%" },
  us_cpi_index: { id: "CPIAUCSL", label: "US CPI Index (for YoY calculation)", unit: "index" },
  us_unemployment: { id: "UNRATE", label: "US Unemployment Rate", unit: "%" },
  us_nonfarm_payrolls: { id: "PAYEMS", label: "US Nonfarm Payrolls", unit: "thousands" },
  us_gdp: { id: "GDP", label: "US Nominal GDP", unit: "$bn" },
  us_10y_yield: { id: "DGS10", label: "US 10-Year Treasury Yield", unit: "%" },

  ecb_deposit_rate: { id: "ECBDFR", label: "ECB Deposit Facility Rate", unit: "%" },
  eu_hicp_index: { id: "CP0000EZ19M086NEST", label: "Euro Area HICP Index (for YoY calculation)", unit: "index" },
  eu_unemployment: { id: "LRHUTTTTEZM156S", label: "Euro Area Unemployment Rate", unit: "%" },

  jp_policy_rate: { id: "IRSTCB01JPM156N", label: "Japan Short-Term Policy Rate", unit: "%" },
  gb_bank_rate: { id: "IUDBEDR", label: "UK Bank Rate", unit: "%" },

  gold_price: { id: "GOLDAMGBD228NLBM", label: "Gold Fixing Price (London, AM)", unit: "USD/oz" },
};

async function fetchObservations(seriesId: string, apiKey: string, limit = 14) {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", String(limit));

  const data = await fetchJson<{ observations?: { date: string; value: string }[] }>(url.toString());
  if (!data.observations || data.observations.length === 0) {
    throw new Error(`FRED returned no observations for ${seriesId}`);
  }
  // FRED marks missing points as "."
  return data.observations.filter((o) => o.value !== ".");
}

function yoyFromIndex(observations: { date: string; value: string }[]): { value: number; date: string } {
  if (observations.length < 13) {
    throw new Error("Not enough observations to compute a year-over-year change");
  }
  const latest = parseFloat(observations[0].value);
  const yearAgo = parseFloat(observations[12].value); // monthly series assumed
  const pct = ((latest - yearAgo) / yearAgo) * 100;
  return { value: Math.round(pct * 100) / 100, date: observations[0].date };
}

export function createFredProvider(apiKey: string): EconomicDataProvider {
  return {
    name: "FRED",
    async fetchIndicator(key: string): Promise<EconomicIndicator> {
      const meta = FRED_SERIES[key];
      if (!meta) throw new Error(`Unknown FRED indicator key: ${key}`);

      const isYoyIndex = key.endsWith("_index");
      const obs = await fetchObservations(meta.id, apiKey, isYoyIndex ? 14 : 1);

      if (isYoyIndex) {
        const { value, date } = yoyFromIndex(obs);
        return {
          source: "FRED",
          indicator: key.replace("_index", "_yoy"),
          label: meta.label.replace("(for YoY calculation)", "— YoY % change"),
          value,
          unit: "% YoY",
          observationDate: date,
          raw: obs.slice(0, 3),
        };
      }

      const latest = obs[0];
      return {
        source: "FRED",
        indicator: key,
        label: meta.label,
        value: parseFloat(latest.value),
        unit: meta.unit,
        observationDate: latest.date,
        raw: latest,
      };
    },
  };
}
