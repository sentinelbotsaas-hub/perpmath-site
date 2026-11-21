// How a result of the futures profit calculator is put into words and
// figures. One function, used by the page at build time (the starting
// example, also what a reader without JavaScript sees) and by the browser
// script, so the two cannot drift apart. Presentation only: every number
// comes from src/lib/calc/profit.ts.
//
// Every figure that is a profit or a loss keeps its sign in the text; the
// tone (green above zero, red below) repeats the printed sign and is never
// the only signal.
//
// Safe to import from a browser script: it depends on src/lib/fmt.ts, the calc
// library and the other dependency-free helpers in this folder.
import { roundToTick } from '../../lib/calc/liquidation';
import type { ProfitOk } from '../../lib/calc/profit';
import { fmt, formatNumber, tickDecimals } from '../../lib/fmt';
import type { BarsLayout } from './scale-bars';
import { signed, signedPercent, toneOf, trimmed } from './signed';
import type { SignTone } from './signed';

/** The templates of `ui` in src/i18n/profit.ts that this file fills in. */
export interface ProfitViewStrings {
  figure: string;
  long: string;
  short: string;
  liquidated: string;
  barLabel: string;
  barEmpty: string;
  barsOff: string;
  liqRow: string;
  usdt: string;
  btc: string;
  noValue: string;
}

export interface TonedText {
  text: string;
  tone?: SignTone;
}

export interface ProfitView {
  /** The big figure with its unit, "+190.37 USDT", or the "no value" text. */
  figure: string;
  figureTone?: SignTone;
  sentence: string;
  state: 'ready' | 'caution';
  gross: TonedText;
  fee: TonedText;
  funding: TonedText;
  roiMargin: TonedText;
  roiNotional: TonedText;
  quantity: string;
  notional: string;
  margin: string;
  breakEven: string;
  liq: string;
  liqLabel: string;
  /** The two bars: P&L before costs, and fees plus funding, both as a share of the margin. NaN = nothing to draw. */
  bars: {
    a: number;
    b: number;
    aValue: string;
    bValue: string;
    aTone?: SignTone;
    bTone?: SignTone;
    caption: (layout: BarsLayout) => string;
  };
}

export interface ProfitContext {
  /** The prices and the leverage as the reader typed them. */
  entry: number;
  exit: number;
  leverage: number;
  tick: number;
}

/** A price the reader typed: whole numbers stay whole. */
export const typedPrice = (n: number) => trimmed(n, 8);
/** A quantity: up to six decimals, without trailing zeros. */
export const showQuantity = (n: number) => trimmed(n, n >= 1 ? 4 : 6);

export function profitView(result: ProfitOk, ctx: ProfitContext, s: ProfitViewStrings): ProfitView {
  const decimals = tickDecimals(ctx.tick);
  const price = (n: number) => formatNumber(roundToTick(n, ctx.tick), decimals);
  const money = (n: number) => formatNumber(n, 2);
  const usdt = (value: string) => fmt(s.usdt, { value });
  const none = s.noValue;

  const base = {
    quantity: fmt(s.btc, { value: showQuantity(result.quantity) }),
    notional: usdt(money(result.notional)),
    margin: usdt(money(result.margin)),
    liq: price(result.liquidationPrice),
    liqLabel: fmt(s.liqRow, { lev: ctx.leverage }),
  };

  // The exit lies at or beyond the liquidation price: no P&L to report.
  if (result.liquidatedBeforeExit) {
    const sentence = fmt(s.liquidated, {
      lev: ctx.leverage,
      liq: base.liq,
      exit: typedPrice(ctx.exit),
      margin: money(result.margin),
    });
    return {
      ...base,
      figure: none,
      sentence,
      state: 'caution',
      gross: { text: none },
      fee: { text: none },
      funding: { text: none },
      roiMargin: { text: none },
      roiNotional: { text: none },
      breakEven: none,
      bars: { a: Number.NaN, b: Number.NaN, aValue: none, bValue: none, caption: () => s.barsOff },
    };
  }

  // Fees are a cost: printed with a minus. A fee of zero has no sign.
  const fee = -result.roundTripFee;
  const grossShare = signedPercent(result.grossReturnOnMargin);
  const costShare = signedPercent(result.costs / result.margin);
  const breakEven = result.breakEvenPrice > 0 ? price(result.breakEvenPrice) : none;

  return {
    ...base,
    figure: fmt(s.figure, { value: signed(result.netPnl) }),
    figureTone: toneOf(result.netPnl),
    sentence: fmt(result.side === 'long' ? s.long : s.short, {
      qty: showQuantity(result.quantity),
      entry: typedPrice(ctx.entry),
      exit: typedPrice(ctx.exit),
      gross: signed(result.grossPnl),
      net: signed(result.netPnl),
      fee: signed(fee),
      funding: signed(result.funding),
      roi: signedPercent(result.netReturnOnMargin),
      margin: money(result.margin),
    }),
    state: 'ready',
    gross: { text: usdt(signed(result.grossPnl)), tone: toneOf(result.grossPnl) },
    fee: { text: usdt(signed(fee)), tone: toneOf(fee) },
    funding: { text: usdt(signed(result.funding)), tone: toneOf(result.funding) },
    roiMargin: { text: signedPercent(result.netReturnOnMargin), tone: toneOf(result.netReturnOnMargin * 100) },
    roiNotional: { text: signedPercent(result.netReturnOnNotional), tone: toneOf(result.netReturnOnNotional * 100) },
    breakEven,
    bars: {
      // Lengths are sizes; the sign is in the printed value next to each bar.
      a: Math.abs(result.grossReturnOnMargin),
      b: Math.abs(result.costs / result.margin),
      aValue: grossShare,
      bValue: costShare,
      aTone: toneOf(result.grossReturnOnMargin * 100),
      bTone: toneOf((result.costs / result.margin) * 100),
      caption: (layout) => (layout.ok ? fmt(s.barLabel, { max: layout.maxLabel, gross: grossShare, costs: costShare }) : s.barEmpty),
    },
  };
}

/** A rate in percent without trailing zeros: 0.0001 -> "0.01%", 0.00055 -> "0.055%". */
export const ratePercent = (fraction: number) => `${trimmed(fraction * 100, 4)}%`;
