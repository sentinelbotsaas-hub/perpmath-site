// Any number of shares of one whole, one bar each, on a scale that runs from 0
// to 100%: markup and the browser-side updater for FillsBars.astro. The DCA
// calculator uses it for each fill's share of the total quantity.
//
// A bar's length is its share of the full width, nothing else: no zoom, no
// minimum length. A fill that is 2% of the total gets a 2% bar.
//
// This file only draws: every share it is given comes from src/lib/calc/.
// Safe to import from a browser script: it has no dependencies.

export interface FillsBarsRow {
  /** "Fill 1". */
  name: string;
  /** The fill's price, formatted: "68,000". */
  price: string;
  /** The share as printed: "25.00%". */
  value: string;
  /** The share as a fraction, 0 to 1. */
  share: number;
}

/** The ticks under the bars. The scale is fixed: the full width is the whole. */
export const FILLS_TICKS = [0, 0.25, 0.5, 0.75, 1];

/** What each root was last drawn with, so an unchanged result leaves the DOM alone. */
const drawn = new WeakMap<HTMLElement, string>();

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Markup of the bars, one per row. Used by the component and the updater. */
export function fillsRowsHtml(rows: FillsBarsRow[]): string {
  return rows
    .map(
      (row) =>
        '<div class="calc-fills-row">' +
        '<div class="calc-fills-head">' +
        `<span class="calc-fills-name">${escapeHtml(row.name)}<span class="num">${escapeHtml(row.price)}</span></span>` +
        `<span class="num">${escapeHtml(row.value)}</span>` +
        '</div>' +
        `<div class="calc-fills-track"><span class="calc-fills-fill" style="--value:${clamp01(row.share).toFixed(4)}"></span></div>` +
        '</div>',
    )
    .join('');
}

/** Markup of the tick marks and their labels: 0%, 25%, 50%, 75%, 100%. */
export function fillsTicksHtml(): string {
  return FILLS_TICKS.map((at) => {
    const label = `${at * 100}%`;
    return (
      `<span class="calc-fills-tick" style="--at:${at}"></span>` +
      `<span class="calc-fills-ticklabel" style="--at:${at}"><span class="num">${label}</span></span>`
    );
  }).join('');
}

/**
 * Redraw the bars FillsBars.astro rendered.
 *
 *   updateFillsBars(el, rows, 'One bar per fill ...');
 *
 * When there is no result, pass the rows with a share of 0 and the "no value"
 * text, and `ready` false: the rows keep their place, so nothing below them
 * moves, and the caption carries the message.
 */
export function updateFillsBars(root: HTMLElement, rows: FillsBarsRow[], caption: string, ready = true): void {
  const part = (name: string) => root.querySelector<HTMLElement>(`[data-fills="${name}"]`);
  const body = part('rows');
  const html = fillsRowsHtml(rows);
  root.dataset.state = ready && rows.length > 0 ? 'ready' : 'empty';
  if (body && drawn.get(body) !== html) {
    body.innerHTML = html;
    drawn.set(body, html);
  }
  const text = part('caption');
  if (text && text.textContent !== caption) text.textContent = caption;
}
