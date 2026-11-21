// How a result of the Sharpe ratio calculator is put into words and figures.
// One function, used by the page at build time (the starting example, also
// what a reader without JavaScript sees) and by the browser script, so the two
// cannot drift apart. Presentation only: every number comes from
// src/lib/calc/sharpe.ts.
//
// Safe to import from a browser script: it depends on src/lib/fmt.ts, the calc
// library and the other dependency-free helpers in this folder.
import { MIN_SAMPLE } from '../../lib/calc/sharpe';
import type { SharpeOk } from '../../lib/calc/sharpe';
import { fmt, formatNumber } from '../../lib/fmt';
import { layoutInterval } from './interval-axis';
import { signed, signedPercent, toneOf, trimmed } from './signed';
import type { SignTone } from './signed';

/** The templates of `ui` in src/i18n/sharpe.ts that this file fills in. */
export interface SharpeViewStrings {
  distinct: string;
  notDistinct: string;
  small: string;
  range: string;
  axisIn: string;
  axisOut: string;
  noValue: string;
}

export interface SharpeView {
  /** The big figure: the annualised Sharpe ratio. */
  figure: string;
  sentence: string;
  /** caution = fewer than MIN_SAMPLE returns. */
  state: 'ready' | 'caution';
  /** The small-sample warning, or null. */
  flag: string | null;
  count: string;
  mean: { text: string; tone?: SignTone };
  deviation: string;
  sharpe: string;
  factor: string;
  se: string;
  interval: string;
  t: string;
  axis: { low: number; high: number; point: number; range: string; value: string; caption: string };
}

/** A ratio at two decimals with a real minus sign and no plus: 1.53, −0.52. */
export const ratio = (n: number, decimals = 2) => signed(n, decimals, false);
/** A per-period return or deviation in percent at four decimals: 0.011833 -> "1.1833%". */
export const percent4 = (fraction: number) => `${formatNumber(fraction * 100, 4)}%`;

export function sharpeView(result: SharpeOk, periodsPerYear: number, s: SharpeViewStrings): SharpeView {
  const { low, high } = result.annualizedInterval;
  const annual = ratio(result.annualizedSharpe);
  const lowText = ratio(low);
  const highText = ratio(high);
  const layout = layoutInterval({ low, high, point: result.annualizedSharpe });
  // The verdict comes from the library, not from the rounded text.
  const includesZero = !result.distinctFromZero;
  /** An end of the axis: a tick value, so it is printed without padding zeros. */
  const axisEnd = (n: number) => (n === 0 ? '0' : `${n < 0 ? '−' : ''}${trimmed(Math.abs(n), 4)}`);
  const range = fmt(s.range, { low: lowText, high: highText });

  return {
    figure: annual,
    sentence: fmt(includesZero ? s.notDistinct : s.distinct, {
      n: formatNumber(result.count),
      sr: ratio(result.sharpe, 4),
      annual,
      periods: trimmed(periodsPerYear, 4),
      low: lowText,
      high: highText,
    }),
    state: result.smallSample ? 'caution' : 'ready',
    flag: result.smallSample ? fmt(s.small, { n: formatNumber(result.count), min: MIN_SAMPLE }) : null,
    count: formatNumber(result.count),
    mean: { text: signedPercent(result.mean, 4), tone: toneOf(result.mean * 100, 4) },
    deviation: percent4(result.standardDeviation),
    sharpe: ratio(result.sharpe, 4),
    factor: formatNumber(result.annualFactor, 4),
    se: formatNumber(result.annualizedStandardError, 2),
    interval: range,
    t: ratio(result.tStatistic),
    axis: {
      low,
      high,
      point: result.annualizedSharpe,
      range,
      value: annual,
      caption: fmt(includesZero ? s.axisIn : s.axisOut, {
        min: axisEnd(layout.min),
        max: axisEnd(layout.max),
        annual,
        low: lowText,
        high: highText,
      }),
    },
  };
}
