// Rule-based fundamental scoring engine.
//
// This deliberately does NOT call an LLM. Instead it's a small, fully
// documented linear model: every indicator's contribution to the score is
// visible in `breakdown`, so a user can see exactly why a number came out
// the way it did (spec Section 34: distinguish FACT from INTERPRETATION).
//
// This buys two things over an AI call:
//   1. Zero marginal cost — runs unlimited times for free.
//   2. Full explainability — no black box between real data and the score.
//
// The tradeoff (be honest about it): it cannot debate itself, find
// historical analogues, or explain a chart/fundamental divergence in prose
// the way a reasoning model can. For that qualitative layer, this project
// intentionally routes to a human-in-the-loop "reasoned import" instead of
// faking it with templates — see /analysis/new and the README.

import type { EconomicIndicator } from "../providers/types";

interface Contribution {
  indicator: string;
  label: string;
  value: number;
  favors: "base" | "quote" | "neutral";
  weight: number;
  contribution: number; // signed, already weighted
  rationale: string;
}

export interface ScoringResult {
  score: number; // -100..100
  confidence: number; // 0..100
  classification: string;
  breakdown: Contribution[];
  missingData: string[];
}

// Documented weights — sum to 100 when all four categories are present.
// If an indicator is missing, its weight is simply excluded from the total
// and confidence drops accordingly (never redistributed silently).
const WEIGHTS = {
  policyRate: 35,
  inflation: 20,
  employment: 20,
  yieldOrGrowth: 25,
};

function classify(score: number, confidence: number): string {
  if (confidence < 35) return "Insufficient Evidence";
  if (score > 65) return "Strong Bullish";
  if (score > 35) return "Bullish";
  if (score > 12) return "Moderately Bullish";
  if (score >= -12) return "Neutral";
  if (score >= -35) return "Moderately Bearish";
  if (score >= -65) return "Bearish";
  return "Strong Bearish";
}

function findIndicator(indicators: EconomicIndicator[], key: string) {
  return indicators.find((i) => i.indicator === key);
}

/**
 * Scores a currency pair (base/quote, e.g. EUR/USD -> base=EUR, quote=USD)
 * from real FRED indicators already fetched via getAssetSnapshot.
 *
 * Logic, per category:
 *  - Policy rate: the currency with the higher / more hawkish-trending rate
 *    is treated as relatively favored (classic carry logic — simplistic,
 *    but transparent).
 *  - Inflation: higher inflation is treated as a headwind for that
 *    currency (implies future easing pressure / real-value erosion),
 *    UNLESS paired with a clearly hawkish central bank response — this V1
 *    model does not attempt that nuance and says so in the rationale.
 *  - Employment: rising unemployment is a headwind.
 *  - Yield: higher long-end yield is a tailwind (capital-flow attraction).
 */
export function scoreForexPair(
  baseIndicators: EconomicIndicator[],
  quoteIndicators: EconomicIndicator[],
  baseLabel: string,
  quoteLabel: string
): ScoringResult {
  const breakdown: Contribution[] = [];
  const missingData: string[] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  // --- Policy rate ---
  const baseRate = findIndicator(baseIndicators, "ecb_deposit_rate") ?? findIndicator(baseIndicators, "us_fed_funds_upper");
  const quoteRate = findIndicator(quoteIndicators, "us_fed_funds_upper") ?? findIndicator(quoteIndicators, "ecb_deposit_rate");
  if (baseRate && quoteRate) {
    const diff = baseRate.value - quoteRate.value;
    const contribution = Math.max(-1, Math.min(1, diff / 3)) * WEIGHTS.policyRate;
    breakdown.push({
      indicator: "policy_rate_differential",
      label: `${baseLabel} vs ${quoteLabel} policy rate`,
      value: diff,
      favors: diff > 0 ? "base" : diff < 0 ? "quote" : "neutral",
      weight: WEIGHTS.policyRate,
      contribution,
      rationale: `${baseRate.label} (${baseRate.value}%) vs ${quoteRate.label} (${quoteRate.value}%). Positive differential is treated as favoring ${baseLabel}.`,
    });
    totalWeight += WEIGHTS.policyRate;
    weightedSum += contribution;
  } else {
    missingData.push("policy rate (one or both sides unavailable)");
  }

  // --- Inflation (YoY) ---
  const baseCpi = findIndicator(baseIndicators, "eu_hicp_yoy") ?? findIndicator(baseIndicators, "us_cpi_yoy");
  const quoteCpi = findIndicator(quoteIndicators, "us_cpi_yoy") ?? findIndicator(quoteIndicators, "eu_hicp_yoy");
  if (baseCpi && quoteCpi) {
    // higher inflation = mild headwind for that currency in this simple model
    const diff = quoteCpi.value - baseCpi.value; // positive => quote has higher inflation => favors base
    const contribution = Math.max(-1, Math.min(1, diff / 2)) * WEIGHTS.inflation;
    breakdown.push({
      indicator: "inflation_differential",
      label: `${baseLabel} vs ${quoteLabel} inflation (YoY)`,
      value: diff,
      favors: diff > 0 ? "base" : diff < 0 ? "quote" : "neutral",
      weight: WEIGHTS.inflation,
      contribution,
      rationale: `${baseCpi.label}: ${baseCpi.value}%. ${quoteCpi.label}: ${quoteCpi.value}%. Higher inflation is treated as a mild headwind — this simple model does not adjust for whether it's already driving hawkish policy.`,
    });
    totalWeight += WEIGHTS.inflation;
    weightedSum += contribution;
  } else {
    missingData.push("inflation (one or both sides unavailable)");
  }

  // --- Employment ---
  const baseUnemp = findIndicator(baseIndicators, "eu_unemployment") ?? findIndicator(baseIndicators, "us_unemployment");
  const quoteUnemp = findIndicator(quoteIndicators, "us_unemployment") ?? findIndicator(quoteIndicators, "eu_unemployment");
  if (baseUnemp && quoteUnemp) {
    const diff = quoteUnemp.value - baseUnemp.value; // positive => quote has higher unemployment => favors base
    const contribution = Math.max(-1, Math.min(1, diff / 2)) * WEIGHTS.employment;
    breakdown.push({
      indicator: "unemployment_differential",
      label: `${baseLabel} vs ${quoteLabel} unemployment rate`,
      value: diff,
      favors: diff > 0 ? "base" : diff < 0 ? "quote" : "neutral",
      weight: WEIGHTS.employment,
      contribution,
      rationale: `${baseUnemp.label}: ${baseUnemp.value}%. ${quoteUnemp.label}: ${quoteUnemp.value}%. Lower unemployment is treated as a tailwind for that currency.`,
    });
    totalWeight += WEIGHTS.employment;
    weightedSum += contribution;
  } else {
    missingData.push("unemployment (one or both sides unavailable)");
  }

  // --- Yield (proxy for growth/capital-flow attraction; quote side only in V1) ---
  const quoteYield = findIndicator(quoteIndicators, "us_10y_yield");
  if (quoteYield) {
    // No comparable long-end euro-area yield wired up in V1 — scored as a
    // standalone signal at reduced weight rather than skipped entirely.
    const neutralPoint = 4.0; // rough historical US 10Y midpoint — arbitrary, documented, adjustable
    const contribution = Math.max(-1, Math.min(1, (neutralPoint - quoteYield.value) / 2)) * (WEIGHTS.yieldOrGrowth * 0.5);
    breakdown.push({
      indicator: "quote_side_yield",
      label: `${quoteLabel} 10-year yield`,
      value: quoteYield.value,
      favors: quoteYield.value > neutralPoint ? "quote" : "base",
      weight: WEIGHTS.yieldOrGrowth * 0.5,
      contribution,
      rationale: `${quoteYield.label}: ${quoteYield.value}%. No comparable euro-area long-end series is wired up yet, so this runs at half weight as a standalone signal rather than a true differential.`,
    });
    totalWeight += WEIGHTS.yieldOrGrowth * 0.5;
    weightedSum += contribution;
  } else {
    missingData.push("10-year yield");
  }

  if (totalWeight === 0) {
    return { score: 0, confidence: 0, classification: "Insufficient Evidence", breakdown, missingData };
  }

  const score = Math.round((weightedSum / totalWeight) * 100);
  const clampedScore = Math.max(-100, Math.min(100, score));
  const dataCompleteness = totalWeight / 100; // fraction of the full 100-weight model actually populated
  const confidence = Math.round(Math.max(15, Math.min(90, dataCompleteness * 90)));

  return {
    score: clampedScore,
    confidence,
    classification: classify(clampedScore, confidence),
    breakdown,
    missingData,
  };
}
