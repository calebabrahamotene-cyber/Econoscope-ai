// ECB Data Portal (SDW) provider — no API key required.
// Docs: https://data.ecb.europa.eu/help/api/overview
//
// This exists mainly to prove the provider architecture is genuinely
// swappable (spec Section 45): FRED already mirrors most ECB series, so in
// practice you may not need this file. It's a second, independent path to
// euro-area data in case FRED's mirror lags or a series is discontinued.
//
// IMPORTANT — same caveat as fred.ts: the flow/key strings below follow the
// ECB SDW REST convention but were not network-verified from this sandbox.
// Confirm against the ECB's own dataset browser before relying on them.

import type { EconomicDataProvider, EconomicIndicator } from "./types";
import { fetchJson } from "./http";

export const ECB_SERIES: Record<string, { flowRef: string; key: string; label: string; unit: string }> = {
  eu_hicp_yoy: {
    flowRef: "ICP",
    key: "M.U2.N.000000.4.ANR", // HICP, monthly, euro area, annual rate of change
    label: "Euro Area HICP — YoY % change",
    unit: "% YoY",
  },
  ecb_deposit_rate: {
    flowRef: "FM",
    key: "D.U2.EUR.4F.KR.DFR.LEV", // ECB deposit facility rate
    label: "ECB Deposit Facility Rate",
    unit: "%",
  },
};

export function createEcbProvider(): EconomicDataProvider {
  return {
    name: "ECB-SDW",
    async fetchIndicator(key: string): Promise<EconomicIndicator> {
      const meta = ECB_SERIES[key];
      if (!meta) throw new Error(`Unknown ECB indicator key: ${key}`);

      const url = `https://data-api.ecb.europa.eu/service/data/${meta.flowRef}/${meta.key}?format=jsondata&lastNObservations=1`;
      const data = await fetchJson<any>(url, { headers: { Accept: "application/vnd.sdmx.data+json;version=1.0.0" } });

      // SDMX-JSON is deeply nested; this walks the standard shape for a
      // single-series, single-observation response. If the ECB changes the
      // response envelope this will throw, which is the correct behaviour
      // (spec Section 49: fail loudly, never fabricate).
      const series = data.dataSets?.[0]?.series?.["0:0:0:0:0:0"];
      const obsDim = data.structure?.dimensions?.observation?.[0]?.values;
      const obsIndexKeys = Object.keys(series?.observations ?? {});
      if (!series || obsIndexKeys.length === 0) {
        throw new Error(`ECB SDW returned no observations for ${key}`);
      }
      const lastIdx = obsIndexKeys[obsIndexKeys.length - 1];
      const value = series.observations[lastIdx][0];
      const date = obsDim?.[parseInt(lastIdx, 10)]?.id ?? "unknown";

      return {
        source: "ECB-SDW",
        indicator: key,
        label: meta.label,
        value: Math.round(value * 100) / 100,
        unit: meta.unit,
        observationDate: date,
        raw: { flowRef: meta.flowRef, key: meta.key },
      };
    },
  };
}
