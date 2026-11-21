// An estimate and the interval around it on one linear axis that always
// contains 0: layout maths and the browser-side updater for
// IntervalAxis.astro. The Sharpe ratio calculator uses it for the annualised
// Sharpe ratio and its 95% interval.
//
// The axis is linear and ends on a labelled tick at both sides. Zero is always
// on it, because the question the picture answers is whether the interval
// reaches zero. Nothing is zoomed or clipped: the band is as long as the
// interval is.
//
// This file only draws: the three numbers it is given come from src/lib/calc/.
// Safe to import from a browser script: the only dependency is src/lib/fmt.ts.
import { formatNumber } from '../../lib/fmt';

export interface IntervalInput {
  /** Lower end of the interval. */
  low: number;
  /** Upper end of the interval. */
  high: number;
  /** The estimate; it lies between the two ends. */
  point: number;
}

export interface IntervalTick {
  /** Position on the axis, 0 to 1. */
  at: number;
  label: string;
}

export interface IntervalLayout {
  /** False when there is nothing to draw. */
  ok: boolean;
  /** The axis runs from `min` to `max`. */
  min: number;
  max: number;
  /** Positions on the axis, 0 to 1. */
  from: number;
  to: number;
  point: number;
  zero: number;
  ticks: IntervalTick[];
}

const EMPTY: IntervalLayout = { ok: false, min: 0, max: 0, from: 0, to: 0, point: 0, zero: 0, ticks: [] };

/** A step of 1, 2, 2.5 or 5 times a power of ten, at or above `raw`. */
function niceStep(raw: number): number {
  const unit = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / unit;
  const pick = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;
  return pick * unit;
}

/** Decimals needed to print a multiple of `step` exactly. */
function stepDecimals(step: number): number {
  for (let d = 0; d <= 8; d++) {
    const scaled = step * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6 * Math.max(1, scaled)) return d;
  }
  return 8;
}

/** A tick label: a real minus sign, and plain "0" for zero. */
function tickLabel(value: number, decimals: number): string {
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return '0';
  const body = formatNumber(Math.abs(rounded), decimals);
  return rounded < 0 ? `−${body}` : body;
}

export function layoutInterval(input: IntervalInput): IntervalLayout {
  const { low, high, point } = input;
  if (![low, high, point].every((n) => typeof n === 'number' && Number.isFinite(n))) return EMPTY;
  if (!(high > low)) return EMPTY;

  // The axis covers the interval and zero, and ends on a tick at both sides.
  const bottom = Math.min(low, 0);
  const top = Math.max(high, 0);
  const step = niceStep((top - bottom) / 5);
  const first = Math.floor(bottom / step + 1e-9);
  const last = Math.ceil(top / step - 1e-9);
  const min = first * step;
  const max = last * step;
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return EMPTY;

  const at = (value: number) => Math.min(1, Math.max(0, (value - min) / span));
  const decimals = stepDecimals(step);
  const ticks: IntervalTick[] = [];
  for (let i = first; i <= last; i++) ticks.push({ at: at(i * step), label: tickLabel(i * step, decimals) });

  return { ok: true, min, max, from: at(low), to: at(high), point: at(point), zero: at(0), ticks };
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Markup of the tick marks and their labels. Used by the component and the updater. */
export function intervalTicksHtml(layout: IntervalLayout): string {
  return layout.ticks
    .map((t) => {
      const at = t.at.toFixed(5);
      return (
        `<span class="calc-span-tick" style="--at:${at}"></span>` +
        `<span class="calc-span-ticklabel" style="--at:${at}"><span class="num">${escapeHtml(t.label)}</span></span>`
      );
    })
    .join('');
}

export interface IntervalText {
  /** The interval as printed in the key: "−0.52 to 3.58". */
  range: string;
  /** The estimate as printed in the key: "1.53". */
  value: string;
  /** The sentence under the axis, which is also its text alternative. */
  caption: string;
}

/**
 * Redraw an axis that IntervalAxis.astro rendered. Only transforms, custom
 * properties and text change, so nothing on the page moves.
 *
 *   updateIntervalAxis(el, { low: -0.52, high: 3.58, point: 1.53 }, { range: '...', value: '1.53', caption: '...' });
 *
 * Pass numbers that cannot be drawn (NaN) to show the empty state; the
 * caption then carries the message.
 */
export function updateIntervalAxis(root: HTMLElement, input: IntervalInput, text: IntervalText): IntervalLayout {
  const layout = layoutInterval(input);
  const part = (name: string) => root.querySelector<HTMLElement>(`[data-span="${name}"]`);
  const setText = (name: string, value: string) => {
    const el = part(name);
    if (el && el.textContent !== value) el.textContent = value;
  };

  root.dataset.state = layout.ok ? 'ready' : 'empty';
  const band = part('band');
  band?.style.setProperty('--from', layout.from.toFixed(5));
  band?.style.setProperty('--to', layout.to.toFixed(5));
  part('point')?.style.setProperty('--at', layout.point.toFixed(5));
  part('zero')?.style.setProperty('--at', layout.zero.toFixed(5));
  setText('range', text.range);
  setText('value', text.value);
  setText('caption', text.caption);

  // The ticks only change when the scale does.
  const ticks = part('ticks');
  const key = layout.ok ? `${layout.min}:${layout.max}` : '';
  if (ticks && ticks.dataset.scale !== key) {
    ticks.innerHTML = intervalTicksHtml(layout);
    ticks.dataset.scale = key;
  }
  return layout;
}
