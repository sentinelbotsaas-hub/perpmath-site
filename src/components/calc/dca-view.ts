// How a result of the DCA calculator is put into words and figures. One
// function, used by the page at build time (the starting example, also what a
// reader without JavaScript sees) and by the browser script, so the two cannot
// drift apart. Presentation only: every number comes from src/lib/calc/dca.ts.
//
// Safe to import from a browser script: it depends on src/lib/fmt.ts, the calc
// library and the other dependency-free helpers in this folder.
import type { DcaOk } from '../../lib/calc/dca';
import { roundToTick } from '../../lib/calc/liquidation';
import { fmt, formatNumber, formatPercent, tickDecimals } from '../../lib/fmt';
import type { FillsBarsRow } from './fills-bars';
import { signed, signedPercent, toneOf, trimmed } from './signed';
import type { SignTone } from './signed';

export type DcaMode = 'futures' | 'spot';

/** The templates of `ui` in src/i18n/dca.ts that this file fills in. */
export interface DcaViewStrings {
  labelFutures: string;
  labelSpot: string;
  figure: string;
  fill: string;
  coin: string;
  coinSpot: string;
  spotOne: string;
  spot: string;
  futuresOne: string;
  long: string;
  short: string;
  liquidated: string;
  usdt: string;
  times: string;
  freshRow: string;
  barItem: string;
  barJoin: string;
  barCaption: string;
  barsOff: string;
  noValue: string;
}

export interface TonedText {
  text: string;
  tone?: SignTone;
}

export interface DcaView {
  /** What the big figure is. */
  label: string;
  /** The big figure with its unit, "64,000 USDT", or the "no value" text. */
  figure: string;
  sentence: string;
  state: 'ready' | 'caution';
  quantity: string;
  cost: string;
  vsFirst: TonedText;
  multiple: string;
  unrealized: TonedText;
  toAverage: TonedText;
  /** Futures only; the "no value" text otherwise. */
  margin: string;
  firstLiq: string;
  liq: string;
  room: string;
  fresh: string;
  freshLabel: string;
  bars: FillsBarsRow[];
  barsReady: boolean;
  caption: string;
}

export interface DcaFormat {
  /** A price the calculation produced (an average, a liquidation price). */
  average(n: number): string;
  liquidation(n: number): string;
  /** A price the reader typed. */
  typed(n: number): string;
  quantity(n: number): string;
  money(n: number): string;
}

/**
 * Futures prices follow the contract's tick. Spot can be any coin, so its
 * prices keep more decimals the smaller they are.
 */
export function dcaFormat(mode: DcaMode, tick: number): DcaFormat {
  const decimals = tickDecimals(tick);
  const loose = (n: number) => trimmed(n, n >= 1000 ? 2 : n >= 1 ? 4 : 8);
  return {
    average: (n) => (mode === 'futures' ? trimmed(roundToTick(n, tick), decimals) : loose(n)),
    liquidation: (n) => formatNumber(roundToTick(n, tick), decimals),
    typed: loose,
    quantity: (n) => trimmed(n, n >= 1 ? 4 : 6),
    money: (n) => formatNumber(n, 2),
  };
}

export function dcaView(result: DcaOk, mode: DcaMode, tick: number, s: DcaViewStrings): DcaView {
  const f = dcaFormat(mode, tick);
  const n = result.steps.length;
  const futures = mode === 'futures' ? result.futures : undefined;
  const coin = mode === 'futures' ? s.coin : s.coinSpot;
  const usdt = (value: number) => fmt(s.usdt, { value: f.money(value) });
  const none = s.noValue;

  const bars: FillsBarsRow[] = result.steps.map((step, i) => ({
    name: fmt(s.fill, { n: i + 1 }),
    price: f.typed(step.price),
    value: formatPercent(step.share),
    share: step.share,
  }));
  const label = mode === 'futures' ? s.labelFutures : s.labelSpot;
  const freshLabel = fmt(s.freshRow, { lev: futures ? futures.leverage : none });

  // A fill beyond the liquidation price of the position before it: there is
  // no combined position to report.
  if (futures && futures.liquidatedBeforeFill !== null) {
    const row = futures.liquidatedBeforeFill;
    const sentence = fmt(s.liquidated, {
      row: row + 1,
      price: f.typed(result.steps[row].price),
      liq: f.liquidation(result.steps[row - 1].liquidationPrice as number),
      lev: futures.leverage,
    });
    return {
      label,
      figure: none,
      sentence,
      state: 'caution',
      quantity: none,
      cost: none,
      vsFirst: { text: none },
      multiple: none,
      unrealized: { text: none },
      toAverage: { text: none },
      margin: none,
      firstLiq: f.liquidation(futures.firstLiquidationPrice),
      liq: none,
      room: none,
      fresh: formatPercent(futures.liquidationDistance),
      freshLabel,
      bars: bars.map((bar) => ({ ...bar, value: none, share: 0 })),
      barsReady: false,
      caption: s.barsOff,
    };
  }

  const avg = f.average(result.averagePrice);
  const qty = f.quantity(result.totalQuantity);
  const vars = {
    n,
    qty,
    coin,
    cost: f.money(result.totalCost),
    avg,
    vs: signedPercent(result.averageVsFirst),
    multiple: formatNumber(result.costMultiple, 2),
    lev: futures ? futures.leverage : '',
    liq: futures ? f.liquidation(futures.liquidationPrice) : '',
    firstLiq: futures ? f.liquidation(futures.firstLiquidationPrice) : '',
    firstMargin: futures ? f.money(futures.firstMargin) : '',
    margin: futures ? f.money(futures.margin) : '',
  };
  const template = futures
    ? n === 1
      ? s.futuresOne
      : futures.side === 'long'
        ? s.long
        : s.short
    : n === 1
      ? s.spotOne
      : s.spot;

  return {
    label,
    figure: fmt(s.figure, { price: avg }),
    sentence: fmt(template, vars),
    state: 'ready',
    quantity: `${qty} ${coin}`,
    cost: usdt(result.totalCost),
    vsFirst: { text: signedPercent(result.averageVsFirst), tone: toneOf(result.averageVsFirst * 100) },
    multiple: fmt(s.times, { value: formatNumber(result.costMultiple, 2) }),
    unrealized: { text: fmt(s.usdt, { value: signed(result.unrealizedAtLast) }), tone: toneOf(result.unrealizedAtLast) },
    toAverage: { text: signedPercent(result.lastToAverage), tone: toneOf(result.lastToAverage * 100) },
    margin: futures ? usdt(futures.margin) : none,
    firstLiq: futures ? f.liquidation(futures.firstLiquidationPrice) : none,
    liq: futures ? f.liquidation(futures.liquidationPrice) : none,
    room: futures ? formatPercent(futures.lastToLiquidation) : none,
    fresh: futures ? formatPercent(futures.liquidationDistance) : none,
    freshLabel,
    bars,
    barsReady: true,
    caption: fmt(s.barCaption, {
      qty,
      coin,
      list: bars.map((bar, i) => fmt(s.barItem, { n: i + 1, price: bar.price, share: bar.value })).join(s.barJoin),
    }),
  };
}
