// The figures of one grid backtest, formatted for display: one view per
// sample. Used by /backtests/<slug>/ of a grid result, its card on
// /backtests/, the home page preview and /bot/, so the same number is never
// printed two ways. The strategy results have ./samples.ts for this.
//
// Build-time only. Every value is read from the result file and passed
// through the formatters in src/lib/backtests/format.ts. The only arithmetic
// is on the ledger: the profit of the completed round trips is the engine's
// trading profit minus the positions it closed at market, and the change in
// equity is the final equity minus the starting capital. A value the engine
// could not compute stays "not computed" (`na`), never 0. Returns and money
// effects carry their sign both ways (+ and −): on these pages gains and
// losses sit side by side.
import { formatCount, formatDay, formatPct, formatPlus, formatPlusPct, formatSigned } from '../../lib/backtests/format';
import { BOUNDS_FIXED, BOUNDS_HINDSIGHT, stayedInRange } from '../../lib/backtests/overview';
import { SAMPLE_KEYS } from '../../lib/backtests/types';
import type { GridResult, GridVariantSample, SampleKey } from '../../lib/backtests/types';
import { fmt } from '../../lib/fmt';

type Sign = -1 | 0 | 1;

const signOf = (value: number | null): Sign => (value === null || !Number.isFinite(value) || value === 0 ? 0 : value < 0 ? -1 : 1);

/** A price with up to two decimals and no padding: 57755.8 -> "57,755.8"; 64738.14978 -> "64,738.15"; 91423 -> "91,423". */
export function formatPrice(value: number): string {
  const text = formatSigned(value, 2) ?? '';
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** A base-asset quantity: 0.08414569 -> "0.0841". */
export function formatQuantity(value: number): string {
  return formatSigned(value, 4) ?? '';
}

/** Money with two decimals, always: 3 -> "3.00"; 58.04 -> "58.04". For amounts that have no direction. */
export function formatUsdt(value: number | null): string | null {
  return formatSigned(value, 2);
}

/** An effect on equity, signed both ways: 53.98 -> "+53.98"; -953.8434 -> "−953.84". */
export function formatUsdtEffect(value: number | null): string | null {
  return formatPlus(value, 2);
}

/** "BTCUSDT" -> "BTC". */
export function baseAsset(symbol: string): string {
  return symbol.replace(/USDT$/, '');
}

/** The strings this needs, from `backtests[locale]`. */
export interface GridStrings {
  na: string;
  range: string;
  samples: Record<SampleKey, string>;
  grid: {
    notes: { hindsight: string; fixed: string; inRange: string; outOfRange: string };
    card: { hindsight: string; fixed: string; inRange: string; outOfRange: string };
  };
}

export interface GridSampleView {
  key: SampleKey;
  /** "In-sample", "Out-of-sample". */
  sample: string;
  rangeLead: string;
  rangeEnd: string;
  totalReturn: string;
  totalReturnSign: Sign;
  roundTrips: string;
  fills: string;
  maxDrawdown: string;
  /** Percent, 0 to 100, or null. For the depth bar. */
  maxDrawdownPct: number | null;
  buyHold: string;
  buyHoldSign: Sign;
  buyHoldFunding: string;
  buyHoldFundingSign: Sign;
  /** Share of bar closes outside the range, "0%". */
  outside: string;
  outsidePct: number;
  liquidated: boolean;
  /** The one thing to keep in mind about this sample, long and short form. Empty when there is none. */
  note: string;
  noteShort: string;
  /** The ledger, as effects on equity in USDT: a minus is money paid or lost. */
  ledger: {
    roundTrips: { text: string; sign: Sign };
    inventory: { text: string; sign: Sign };
    fees: { text: string; sign: Sign };
    funding: { text: string; sign: Sign };
    liquidation: { text: string; sign: Sign };
    net: { text: string; sign: Sign };
  };
  /** Positions still open at the end and closed at market: quantity, price and profit. */
  closing: Array<{ quantity: string; price: string; pnl: string }>;
}

const money = (value: number | null, na: string) => ({ text: formatUsdtEffect(value) ?? na, sign: signOf(value) });

/** `grid.bounds_source` must be one of the two values the engine documents. */
function boundsKind(result: GridResult): 'hindsight' | 'fixed' {
  const source = result.grid.bounds_source;
  if (source === BOUNDS_HINDSIGHT) return 'hindsight';
  if (source === BOUNDS_FIXED) return 'fixed';
  throw new Error(`backtests/${result.slug}: unknown grid.bounds_source "${source}"`);
}

export function gridViews(result: GridResult, t: GridStrings): GridSampleView[] {
  const bounds = boundsKind(result);
  const capital = result.config.execution.initial_capital;
  return SAMPLE_KEYS.map((key) => {
    const block = result[key];
    const m = block.metrics;
    const bh = block.buy_and_hold;
    const closed = block.closing_fills.filter((fill) => fill.pnl !== null);
    const inventory = closed.reduce((sum, fill) => sum + (fill.pnl as number), 0);
    const inRange = stayedInRange(result, key);
    const outside = formatPct(m.bars_outside_range_pct) ?? t.na;

    // In-sample, the thing to know is where the bounds came from. After
    // that, whether price stayed inside them.
    const about =
      key === 'in_sample'
        ? { long: t.grid.notes[bounds], short: t.grid.card[bounds] }
        : inRange
          ? { long: t.grid.notes.inRange, short: t.grid.card.inRange }
          : { long: fmt(t.grid.notes.outOfRange, { pct: outside }), short: t.grid.card.outOfRange };

    return {
      key,
      sample: t.samples[key],
      rangeLead: fmt(t.range, { from: formatDay(block.first_bar), to: '' }).trim(),
      rangeEnd: formatDay(block.last_bar),
      totalReturn: formatPlusPct(m.total_return_pct) ?? t.na,
      totalReturnSign: signOf(m.total_return_pct),
      roundTrips: formatCount(m.round_trips),
      fills: formatCount(m.fills),
      maxDrawdown: formatPct(m.max_drawdown_pct) ?? t.na,
      maxDrawdownPct: m.max_drawdown_pct,
      buyHold: formatPlusPct(bh.return_pct) ?? t.na,
      buyHoldSign: signOf(bh.return_pct),
      buyHoldFunding: formatPlusPct(bh.return_with_funding_pct) ?? t.na,
      buyHoldFundingSign: signOf(bh.return_with_funding_pct),
      outside,
      outsidePct: m.bars_outside_range_pct,
      liquidated: m.liquidated,
      note: about.long,
      noteShort: about.short,
      ledger: {
        roundTrips: money(m.trading_pnl - inventory, t.na),
        inventory: money(inventory, t.na),
        fees: money(-m.total_fees, t.na),
        funding: money(m.funding_paid === null ? null : -m.funding_paid, t.na),
        liquidation: money(-m.liquidation_loss, t.na),
        net: money(m.final_equity - capital, t.na),
      },
      closing: closed.map((fill) => ({
        quantity: formatQuantity(fill.quantity),
        price: formatPrice(fill.price),
        pnl: formatUsdtEffect(fill.pnl) ?? t.na,
      })),
    };
  });
}

/** One line of the comparison tables: a variant of the run, or the published run itself. */
export interface GridVariantView {
  totalReturn: Record<SampleKey, string>;
  totalReturnSign: Record<SampleKey, Sign>;
  roundTrips: Record<SampleKey, string>;
  fees: Record<SampleKey, string>;
}

function variantView(samples: Record<SampleKey, GridVariantSample>, na: string): GridVariantView {
  const pick = <T>(f: (s: GridVariantSample) => T) =>
    Object.fromEntries(SAMPLE_KEYS.map((key) => [key, f(samples[key])])) as Record<SampleKey, T>;
  return {
    totalReturn: pick((s) => formatPlusPct(s.total_return_pct) ?? na),
    totalReturnSign: pick((s) => signOf(s.total_return_pct)),
    roundTrips: pick((s) => formatCount(s.round_trips)),
    fees: pick((s) => formatUsdt(s.total_fees) ?? na),
  };
}

/** The published run in the shape of a `comparisons` entry, so it can sit in the same table. */
export function publishedVariant(result: GridResult, na: string): GridVariantView {
  const sample = (key: SampleKey): GridVariantSample => {
    const m = result[key].metrics;
    return {
      total_return_pct: m.total_return_pct,
      max_drawdown_pct: m.max_drawdown_pct,
      round_trips: m.round_trips,
      grid_fills: m.grid_fills,
      total_fees: m.total_fees,
      funding_paid: m.funding_paid,
      liquidated: m.liquidated,
    };
  };
  return variantView({ in_sample: sample('in_sample'), out_of_sample: sample('out_of_sample') }, na);
}

/** A named entry of `comparisons`, or null when this run does not have it. */
export function comparisonVariant(result: GridResult, name: string, na: string): GridVariantView | null {
  const entry = result.comparisons[name];
  return entry ? variantView(entry, na) : null;
}
