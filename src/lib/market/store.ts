// Build-time access to the files scripts/fetch-market.mjs wrote into
// src/data/market/. Astro pages only: it uses import.meta.glob, so do not
// import it from a browser script or from the fetch script.
//
// A missing latest.json stops the build with a message instead of producing a
// page with no numbers on it.
import type { MarketReport } from './report.ts';
import { COINS } from './view.ts';
import type { Coin, MarketSymbol } from './view.ts';

const files = import.meta.glob<MarketReport>('/src/data/market/*/*.json', { eager: true, import: 'default' });

const DATED = /^\/src\/data\/market\/([A-Z0-9]+)\/(\d{4}-\d{2}-\d{2})\.json$/;

export function symbolOf(coin: Coin): MarketSymbol {
  const found = COINS.find((c) => c.coin === coin);
  if (!found) throw new Error(`Unknown coin: ${coin}`);
  return found.symbol;
}

/** The newest report of a symbol. */
export function latestReport(symbol: MarketSymbol): MarketReport {
  const report = files[`/src/data/market/${symbol}/latest.json`];
  if (!report) {
    throw new Error(`src/data/market/${symbol}/latest.json is missing. Run: node scripts/fetch-market.mjs`);
  }
  return report;
}

/** The newest report of each of the three symbols, in page order. */
export function latestReports(): Array<{ coin: Coin; symbol: MarketSymbol; report: MarketReport }> {
  return COINS.map(({ coin, symbol }) => ({ coin, symbol, report: latestReport(symbol) }));
}

/** Every dated report of a symbol, newest first. */
export function datedReports(symbol: MarketSymbol): Array<{ date: string; report: MarketReport }> {
  return Object.entries(files)
    .map(([path, report]) => ({ match: DATED.exec(path), report }))
    .filter((entry) => entry.match && entry.match[1] === symbol)
    .map((entry) => ({ date: (entry.match as RegExpExecArray)[2], report: entry.report }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
