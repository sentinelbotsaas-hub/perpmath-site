// Two quantities drawn as two bars on one shared, zero-based scale: layout
// maths and the browser-side updater for ScaleBars.astro.
//
// Both bars start at 0 and share one linear axis, so their lengths compare at
// the true ratio of the two numbers. The axis does not have to end at 100%:
// its end is either given by the caller (the drawdown calculator passes the
// scale the calc library returns) or the first "nice" tick at or above the
// longer bar. Whatever it is, the ticks under the bars and the caption say
// what the full width stands for, so a zoomed scale is always labelled.
//
// Values are fractions (0.05 means 5%). This file only draws: every number it
// is given comes from src/lib/calc/.
//
// Safe to import from a browser script: the only dependency is src/lib/fmt.ts.
import { formatNumber } from '../../lib/fmt';

export interface BarsInput {
  /** First bar, as a fraction. */
  a: number;
  /** Second bar, as a fraction. */
  b: number;
  /** What the full width stands for, as a fraction. Left out: a nice value at or above the longer bar. */
  max?: number;
}

export interface BarsTick {
  /** Position on the axis, 0 to 1. */
  at: number;
  label: string;
}

export interface BarsLayout {
  /** False when there is nothing to draw. */
  ok: boolean;
  /** The axis runs from 0 to this fraction. */
  max: number;
  /** `max` as text: "6%", "0.5%", "233.33%". */
  maxLabel: string;
  /** Length of each bar as a share of the full width, 0 to 1. */
  aShare: number;
  bShare: number;
  ticks: BarsTick[];
}

const drawable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** A step of 1, 2, 2.5 or 5 times a power of ten, at or above `raw`. */
function niceStep(raw: number): number {
  const unit = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / unit;
  const pick = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;
  return pick * unit;
}

/** Decimals needed to print a multiple of `stepPct` (a step in percent) exactly. */
function stepDecimals(stepPct: number): number {
  for (let d = 0; d <= 6; d++) {
    const scaled = stepPct * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return d;
  }
  return 6;
}

const EMPTY: BarsLayout = { ok: false, max: 0, maxLabel: '', aShare: 0, bShare: 0, ticks: [] };

export function layoutScaleBars(input: BarsInput): BarsLayout {
  if (!drawable(input.a) || !drawable(input.b)) return EMPTY;
  const top = Math.max(input.a, input.b);
  const given = typeof input.max === 'number' && Number.isFinite(input.max) && input.max > 0 ? input.max : null;
  if (given === null && top <= 0) return EMPTY;

  // About four intervals. Without a given end, the axis ends on a tick.
  const step = niceStep((given ?? top) / 4);
  const max = given ?? Math.ceil(top / step - 1e-9) * step;
  const decimals = stepDecimals(step * 100);
  const percent = (fraction: number, places: number) => (fraction === 0 ? '0%' : `${formatNumber(fraction * 100, places)}%`);

  const ticks: BarsTick[] = [];
  for (let i = 0; i * step <= max * (1 + 1e-9); i++) {
    ticks.push({ at: clamp01((i * step) / max), label: percent(i * step, decimals) });
  }

  return {
    ok: true,
    max,
    // A given end is rarely a round number: print it the way results are printed.
    maxLabel: given === null ? percent(max, decimals) : percent(max, 2),
    aShare: clamp01(input.a / max),
    bShare: clamp01(input.b / max),
    ticks,
  };
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Markup of the tick marks and their labels. Used by the component and the updater. */
export function barsTicksHtml(layout: BarsLayout): string {
  return layout.ticks
    .map((t) => {
      const at = t.at.toFixed(5);
      return (
        `<span class="calc-bars-tick" style="--at:${at}"></span>` +
        `<span class="calc-bars-ticklabel" style="--at:${at}"><span class="num">${escapeHtml(t.label)}</span></span>`
      );
    })
    .join('');
}

export interface BarsText {
  /** Label and printed value of each bar. */
  aLabel?: string;
  aValue: string;
  bLabel?: string;
  bValue: string;
  /**
   * The sentence under the bars, which is also their text alternative. It
   * gets the layout so that it can name the scale: (layout) => `... ${layout.maxLabel} ...`.
   */
  caption: (layout: BarsLayout) => string;
}

/**
 * Redraw bars that ScaleBars.astro rendered. Only transforms, custom
 * properties and text change, so nothing on the page moves.
 *
 *   updateScaleBars(el, { a: 0.05, b: 0.0523 }, { aValue: '5.00%', bValue: '5.23%', caption: (l) => `...` });
 *
 * Pass numbers that cannot be drawn (NaN) to show the empty state; the
 * caption then carries the message.
 */
export function updateScaleBars(root: HTMLElement, input: BarsInput, text: BarsText): BarsLayout {
  const layout = layoutScaleBars(input);
  const part = (name: string) => root.querySelector<HTMLElement>(`[data-bars="${name}"]`);
  const setText = (name: string, value: string | undefined) => {
    const el = part(name);
    if (el && value !== undefined && el.textContent !== value) el.textContent = value;
  };

  root.dataset.state = layout.ok ? 'ready' : 'empty';
  part('a-fill')?.style.setProperty('--value', layout.aShare.toFixed(4));
  part('b-fill')?.style.setProperty('--value', layout.bShare.toFixed(4));
  setText('a-label', text.aLabel);
  setText('a-value', text.aValue);
  setText('b-label', text.bLabel);
  setText('b-value', text.bValue);
  setText('caption', text.caption(layout));

  // The ticks only change when the scale does.
  const ticks = part('ticks');
  const key = layout.ok ? String(layout.max) : '';
  if (ticks && ticks.dataset.max !== key) {
    ticks.innerHTML = barsTicksHtml(layout);
    ticks.dataset.max = key;
  }
  return layout;
}
