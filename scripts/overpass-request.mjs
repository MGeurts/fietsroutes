import { setTimeout as delay } from 'node:timers/promises';

export function retryDelay(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}
export async function requestOverpass(query, { fetcher = fetch, wait = ms => delay(ms), report = console.log, signal, endpoint = 'https://overpass-api.de/api/interpreter' } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    signal?.throwIfAborted();
    try {
      const timeout = AbortSignal.timeout(90000);
      const response = await fetcher(endpoint, {
        method: 'POST', body: new URLSearchParams({ data: query }), signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { 'User-Agent': 'Fietsroutes-Vlaanderen-data-import/1.3 (https://github.com/MGeurts/fietsroutes)' },
      });
      if (!response.ok) {
        const error = new Error(`Overpass HTTP ${response.status}`);
        error.retryable = [429, 500, 502, 503, 504].includes(response.status);
        error.delay = Math.max(retryDelay(response.headers?.get('retry-after')), response.status === 429 ? 60000 : 0);
        // Release the connection even when the server returns an error page.
        await response.body?.cancel();
        throw error;
      }
      const data = await response.json();
      if (data.remark || !Array.isArray(data.elements)) {
        const detail = typeof data.remark === 'string' ? data.remark.replace(/[\r\n\t]+/g, ' ').slice(0, 600) : 'De lijst met OSM-objecten ontbreekt.';
        const error = new Error(`Onvolledige Overpass-respons: ${detail}`);
        error.retryable = !/parse error|static error/i.test(detail);
        error.resourceLimit = /out of memory|timed out|timeout|runtime error/i.test(detail);
        throw error;
      }
      return data.elements;
    } catch (error) {
      signal?.throwIfAborted();
      if (attempt === 3 || error.retryable === false || error.resourceLimit) throw new Error(`${error.message}; bestaande snapshot behouden.`, { cause: error });
      let remaining = Math.max(10000 * 2 ** (attempt - 1), error.delay || 0);
      report(`${error.message}. Nieuwe poging ${attempt + 1}/3 over ${Math.ceil(remaining / 1000)} seconden…`);
      while (remaining > 0) { signal?.throwIfAborted(); const part = Math.min(remaining, 60000); await wait(part); remaining -= part; }
    }
  }
}
