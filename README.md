# EconoScope AI — Version 1 (real-data build)

A fundamentals-first economic research tool. This build replaces the
original spec's "call an LLM for everything" pipeline with a **free,
hybrid architecture**:

- **Real data, fully automated, $0 cost** — live economic indicators from
  FRED and ECB SDW, live prices from exchangerate.host / CoinGecko.
- **Transparent scoring, fully automated, $0 cost** — a documented,
  rule-based model (`lib/scoring/engine.ts`) turns real indicators into a
  score with a visible breakdown, instead of an AI black box.
- **Qualitative reasoning (the debate, historical analogues, "why is the
  chart different") stays human-in-the-loop** — do that research with an
  assistant that has live web search (e.g. a chat session), then paste the
  result into `/analysis/new`. This is the one part of the original spec
  that genuinely costs money to fully automate (an LLM API call per
  analysis), so V1 keeps it manual and free rather than faking it with
  templates.

## 1. Project structure
