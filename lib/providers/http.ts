// Shared HTTP helper for all data providers.
//
// Two production concerns this exists to solve, both invisible in local
// dev but real on Netlify:
//
// 1. Next.js caches plain `fetch()` calls by default. For a tool whose
//    entire premise is "current data," a cached economic indicator from
//    an earlier request is a correctness bug, not a performance win — so
//    every call here forces `cache: "no-store"`.
// 2. Serverless functions have a hard execution-time ceiling (Netlify's
//    free tier gives synchronous functions 10 seconds). If an upstream
//    API (FRED, ECB, etc.) hangs, we want OUR code to fail cleanly within
//    a few seconds — surfacing as one failed indicator — rather than the
//    whole function running out the clock and failing every indicator at
//    once. Hence the AbortController timeout below.

export async function fetchJson<T = any>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<T> {
  const { timeoutMs = 7000, headers } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store", headers });
    if (!res.ok) {
      let host = url;
      try { host = new URL(url).host; } catch { /* keep full url as fallback */ }
      throw new Error(`Request to ${host} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
