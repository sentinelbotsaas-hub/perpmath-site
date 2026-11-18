// Daily market data for the report and the data pages.
//
//   node scripts/fetch-market.mjs                 BTCUSDT, ETHUSDT, SOLUSDT
//   node scripts/fetch-market.mjs BTCUSDT         one symbol
//   node scripts/fetch-market.mjs --out=some/dir  write somewhere else (for trying it out)
//
// Writes, per symbol:
//   src/data/market/<SYMBOL>/latest.json
//   src/data/market/<SYMBOL>/<YYYY-MM-DD>.json    (the report day: the last complete UTC day)
//
// Public Bybit v5 endpoints, no API key (the exact URLs are stored in the file):
//   /v5/market/kline             interval=D   daily candles, 130 requested, 120 complete ones required
//   /v5/market/kline             interval=60  the 24 hourly candles of the report day
//   /v5/market/tickers                        price, funding period in progress, open interest now
//   /v5/market/funding/history                settlements up to the end of the report day (30 days required)
//   /v5/market/open-interest     intervalTime=1d
//   /v5/market/account-ratio     period=1d
//   /v5/market/risk-limit                     tier 1 maintenance margin rate and leverage cap
//   /v5/market/instruments-info               tick size, base coin
//
// The arithmetic is not here: it lives in src/lib/market/ (compute.ts,
// parse.ts, report.ts), where it has tests. Node runs those TypeScript files
// directly, which needs Node 22.18 or newer.
//
// Failure rule: every symbol is fetched, checked and computed in memory first.
// If any response is empty, malformed or inconsistent, the script prints the
// reason, exits 1 and has not touched a single file. Files are written through
// a temporary name and renamed, so a build can never read half a file.
// Not part of `prebuild` on purpose: the build must work offline.
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAY_MS, HOUR_MS } from '../src/lib/market/compute.ts';
import {
  completeCandles,
  parseFunding,
  parseInstrument,
  parseKlines,
  parseOpenInterest,
  parseRatio,
  parseTicker,
  parseTierOne,
} from '../src/lib/market/parse.ts';
import { TABLE_DAYS, buildReport } from '../src/lib/market/report.ts';

const API = 'https://api.bybit.com/v5/market';
const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const PAUSE_MS = 250; // between requests; far below Bybit's public rate limit
const FUNDING_PAGES_MAX = 5;

const args = process.argv.slice(2);
const outArg = args.find((a) => a.startsWith('--out='));
const symbols = args.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase());
const OUT = outArg
  ? resolve(outArg.slice('--out='.length))
  : fileURLToPath(new URL('../src/data/market', import.meta.url));

function fail(message) {
  console.error(`fetch-market: ${message}`);
  console.error('fetch-market: nothing was written; the existing files are unchanged.');
  process.exit(1);
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** An answer from Bybit that will not get better by asking again. */
class AnswerError extends Error {}

/** GET one endpoint. Retries transport errors and 5xx/429 twice; never retries a Bybit error code. */
async function getJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new AnswerError(`HTTP ${res.status} for ${url}`);
      const body = await res.json();
      if (!body || typeof body !== 'object') throw new AnswerError(`not a JSON object: ${url}`);
      if (body.retCode !== 0) throw new AnswerError(`retCode ${body.retCode} (${body.retMsg}) for ${url}`);
      if (!body.result || typeof body.result !== 'object') throw new AnswerError(`no result in ${url}`);
      await sleep(PAUSE_MS);
      return body;
    } catch (error) {
      if (error instanceof AnswerError) throw error;
      lastError = error;
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  throw new Error(`${lastError instanceof Error ? lastError.message : String(lastError)} for ${url}`);
}

async function fetchSymbol(symbol) {
  const q = `category=linear&symbol=${symbol}`;
  const endpoints = {};
  const get = async (name, path) => {
    endpoints[name] = `${API}/${path}`;
    return getJson(endpoints[name]);
  };

  // Daily candles first: they decide which day the report is about. Bybit's
  // own clock (the `time` field of the response) says which candle is complete.
  const dailyBody = await get('dailyKlines', `kline?${q}&interval=D&limit=130`);
  const serverTime = Number(dailyBody.time);
  if (!Number.isFinite(serverTime)) throw new Error('kline response carries no server time');
  const daily = completeCandles(parseKlines(dailyBody.result.list, DAY_MS, 'daily kline'), DAY_MS, serverTime);
  if (daily.length === 0) throw new Error('no complete daily candle');
  const dayStart = daily[daily.length - 1].start;
  const dayEnd = dayStart + DAY_MS;

  const hourlyBody = await get('hourlyKlines', `kline?${q}&interval=60&start=${dayStart}&end=${dayEnd - 1}&limit=24`);
  const hourly = parseKlines(hourlyBody.result.list, HOUR_MS, 'hourly kline');

  const tickerBody = await get('tickers', `tickers?${q}`);
  const ticker = parseTicker(tickerBody.result.list, symbol);

  // Funding settlements, newest first, 200 per page. Three a day needs one
  // page; a symbol on a one-hour interval needs more.
  let funding = [];
  let endTime = dayEnd - 1;
  for (let page = 1; page <= FUNDING_PAGES_MAX; page++) {
    const body = await get(page === 1 ? 'fundingHistory' : `fundingHistory${page}`, `funding/history?${q}&endTime=${endTime}&limit=200`);
    const points = parseFunding(body.result.list);
    funding = [...points, ...funding];
    if (points[0].time <= dayEnd - (TABLE_DAYS + 1) * DAY_MS) break;
    endTime = points[0].time - 1;
  }

  const oiBody = await get('openInterest', `open-interest?${q}&intervalTime=1d&endTime=${dayEnd}&limit=40`);
  const ratioBody = await get('accountRatio', `account-ratio?${q}&period=1d&endTime=${dayEnd}&limit=40`);
  const riskBody = await get('riskLimit', `risk-limit?${q}`);
  const infoBody = await get('instrumentsInfo', `instruments-info?${q}`);

  return buildReport({
    symbol,
    fetchedAt: new Date().toISOString(),
    serverTime,
    endpoints,
    instrument: parseInstrument(infoBody.result.list, symbol),
    tierOne: parseTierOne(riskBody.result.list, symbol),
    ticker,
    daily,
    hourly,
    funding,
    openInterest: parseOpenInterest(oiBody.result.list),
    ratio: parseRatio(ratioBody.result.list),
  });
}

function writeAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, text);
  renameSync(temporary, file);
}

const list = symbols.length > 0 ? symbols : DEFAULT_SYMBOLS;
for (const symbol of list) {
  if (!/^[A-Z0-9]{3,20}$/.test(symbol)) fail(`bad symbol: ${symbol}`);
}

const reports = [];
for (const symbol of list) {
  try {
    reports.push(await fetchSymbol(symbol));
  } catch (error) {
    fail(`${symbol}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// One run, one report day: the three symbols share Bybit's daily boundary.
const dates = new Set(reports.map((r) => r.reportDate));
if (dates.size !== 1) fail(`symbols disagree on the report day: ${[...dates].join(', ')}`);

for (const report of reports) {
  const text = JSON.stringify(report, null, 2) + '\n';
  writeAtomic(join(OUT, report.symbol, `${report.reportDate}.json`), text);
  writeAtomic(join(OUT, report.symbol, 'latest.json'), text);
  const safe = report.survival.filter((row) => !row.long.liquidated && !row.short.liquidated).map((row) => row.leverage);
  console.log(
    `Wrote ${report.symbol} ${report.reportDate}: open ${report.day.open}, low ${report.day.low}, high ${report.day.high}, ` +
      `drop ${(report.day.adverseLong * 100).toFixed(2)}%, rise ${(report.day.adverseShort * 100).toFixed(2)}%, ` +
      `survived both ways up to ${safe.length ? Math.max(...safe) : 0}x, MMR ${report.instrument.tierOne.maintenanceMargin}, ` +
      `fetched ${report.fetchedAt}`,
  );
}
