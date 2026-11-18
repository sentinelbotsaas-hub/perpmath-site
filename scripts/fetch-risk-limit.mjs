// Snapshot of Bybit's maintenance-margin tiers for one USDT perpetual.
//
//   node scripts/fetch-risk-limit.mjs            BTCUSDT
//   node scripts/fetch-risk-limit.mjs ETHUSDT
//
// Writes src/data/risk-limit/<SYMBOL>.json. Public endpoints, no API key:
//   GET /v5/market/risk-limit?category=linear&symbol=<SYMBOL>        (tiers)
//   GET /v5/market/instruments-info?category=linear&symbol=<SYMBOL>  (tick size)
// On any failure the script exits non-zero and leaves the old file untouched,
// so a build can never ship an empty or half-written snapshot.
// Not part of `prebuild` on purpose: the build must work offline.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.bybit.com';
const symbol = (process.argv[2] || 'BTCUSDT').toUpperCase();
if (!/^[A-Z0-9]{3,20}$/.test(symbol)) fail(`Bad symbol: ${symbol}`);

function fail(message) {
  console.error(`fetch-risk-limit: ${message}`);
  process.exit(1);
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = await res.json();
  if (body.retCode !== 0) throw new Error(`retCode ${body.retCode} (${body.retMsg}) for ${url}`);
  return body.result;
}

const num = (value, name) => {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} is not a number: ${JSON.stringify(value)}`);
  return n;
};

try {
  const riskUrl = `${API}/v5/market/risk-limit?category=linear&symbol=${symbol}`;
  const infoUrl = `${API}/v5/market/instruments-info?category=linear&symbol=${symbol}`;
  const [risk, info] = await Promise.all([getJson(riskUrl), getJson(infoUrl)]);

  const rows = (risk.list || []).filter((r) => r.symbol === symbol);
  if (rows.length === 0) throw new Error('risk-limit returned no tiers');
  const instrument = (info.list || []).find((r) => r.symbol === symbol);
  if (!instrument) throw new Error('instruments-info returned no instrument');

  const tiers = rows
    .map((r) => ({
      tier: num(r.id, 'id'),
      // Upper bound of the tier, in USDT of position value.
      riskLimitValue: num(r.riskLimitValue, 'riskLimitValue'),
      // Fractions, not percent: 0.0033 is 0.33%.
      maintenanceMargin: num(r.maintenanceMargin, 'maintenanceMargin'),
      initialMargin: num(r.initialMargin, 'initialMargin'),
      maxLeverage: num(r.maxLeverage, 'maxLeverage'),
      mmDeduction: r.mmDeduction === '' ? 0 : num(r.mmDeduction, 'mmDeduction'),
    }))
    .sort((a, b) => a.riskLimitValue - b.riskLimitValue)
    .map((t, i) => ({ ...t, tier: i + 1 }));

  const snapshot = {
    symbol,
    category: 'linear',
    source: riskUrl,
    tickSizeSource: infoUrl,
    fetchedAt: new Date().toISOString(),
    tickSize: num(instrument.priceFilter?.tickSize, 'tickSize'),
    tiers,
  };

  const out = fileURLToPath(new URL(`../src/data/risk-limit/${symbol}.json`, import.meta.url));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(
    `Wrote ${symbol}.json: ${tiers.length} tiers, tier 1 MMR ${tiers[0].maintenanceMargin}, tick ${snapshot.tickSize}, fetched ${snapshot.fetchedAt}`,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
