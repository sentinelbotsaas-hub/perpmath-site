// The risk ruler: layout maths and the browser-side updater.
//
// One pure function, layoutRiskRuler(), decides everything that is drawn: the
// axis range, the ticks, where the marks sit and what the labels say.
// RiskRuler.astro calls it at build time; a calculator script calls
// updateRiskRuler() with new numbers and gets exactly the same picture.
//
// The axis always starts at 0 and is linear, so the gap between the entry
// price and the liquidation price is drawn at its true share of the price.
// It is never zoomed.
//
// Safe to import from a browser script: the only dependency is src/lib/fmt.ts.
// The strings arrive as JSON in a data attribute (never import src/i18n here,
// it would pull the OpenCC dictionary into the bundle).
import { fmt, formatNumber, formatPercent } from '../../lib/fmt';

export type RulerSide = 'long' | 'short';

export interface RulerInput {
  /** Entry price. Must be a finite number above 0. */
  entry: number;
  /** Liquidation price. Must be a finite number above 0. */
  liquidation: number;
  side: RulerSide;
  /** Current price, optional. Ignored unless it is a finite number above 0. */
  current?: number | null;
}

export interface RulerOptions {
  /** Unit printed after prices. Default "USDT". */
  unit?: string;
  /** Decimals for the entry, liquidation and current prices. Default 0. */
  decimals?: number;
  /**
   * Decimals for the entry price alone, when the page prints it differently
   * from the liquidation price (an entry of 68,000 next to a liquidation
   * price on a 0.1 tick). A number, or "auto": as few as the entry needs,
   * never more than `decimals`. Default: the same as `decimals`.
   */
  entryDecimals?: number | 'auto';
}

/** The fewest decimals, up to `max`, that print `value` without losing a digit. */
function neededDecimals(value: number, max: number): number {
  for (let d = 0; d < max; d++) {
    if (Number(value.toFixed(d)) === Number(value.toFixed(max))) return d;
  }
  return max;
}

/** common[locale].ruler from src/i18n/common.ts. */
export interface RulerStrings {
  entry: string;
  liquidation: string;
  current: string;
  long: string;
  short: string;
  distance: string;
  summaryLong: string;
  summaryShort: string;
  summaryCurrent: string;
  summaryPast: string;
  scale: string;
  empty: string;
}

export interface RulerTick {
  /** Position on the axis, 0 to 1. */
  at: number;
  major: boolean;
  /** Text under a major tick; empty for a minor tick. */
  label: string;
  /** Every second major label is dropped when the ruler is narrow. */
  alt: boolean;
}

export interface RulerLayout {
  /** False when the inputs cannot be drawn; only `summary` is meaningful then. */
  ok: boolean;
  side: RulerSide;
  /** The axis runs from 0 to this price. */
  max: number;
  ticks: RulerTick[];
  entryAt: number;
  liqAt: number;
  /** null when there is no current price. */
  currentAt: number | null;
  /** The band between the two marks: where it starts and how long it is, 0 to 1. */
  gapFrom: number;
  gapLen: number;
  /** |entry - liquidation| / entry. */
  distance: number;
  /** |entry - liquidation| in price units. */
  gap: number;
  text: {
    side: string;
    entry: string;
    liquidation: string;
    current: string;
    distance: string;
    /** The full sentence: the text alternative of the picture. */
    summary: string;
  };
}

const usable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** 17000 -> 20000, 0.013 -> 0.02. Steps are 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(raw: number): { step: number; minor: number; decimals: number } {
  const power = Math.floor(Math.log10(raw));
  const unit = 10 ** power;
  const ratio = raw / unit;
  const pick = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;
  const step = pick * unit;
  const minor = pick === 2 ? 4 : 5;
  const decimals = Math.max(0, -power + (pick === 2.5 ? 1 : 0));
  return { step, minor, decimals: pick === 10 ? Math.max(0, -power - 1) : decimals };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function layoutRiskRuler(input: RulerInput, strings: RulerStrings, options: RulerOptions = {}): RulerLayout {
  const unit = options.unit ?? 'USDT';
  const decimals = options.decimals ?? 0;
  const side: RulerSide = input.side === 'short' ? 'short' : 'long';
  const sideText = side === 'long' ? strings.long : strings.short;

  if (!usable(input.entry) || !usable(input.liquidation)) {
    return {
      ok: false,
      side,
      max: 0,
      ticks: [],
      entryAt: 0,
      liqAt: 0,
      currentAt: null,
      gapFrom: 0,
      gapLen: 0,
      distance: 0,
      gap: 0,
      text: { side: sideText, entry: '', liquidation: '', current: '', distance: '', summary: strings.empty },
    };
  }

  const { entry, liquidation } = input;
  const current = usable(input.current) ? input.current : null;
  const top = Math.max(entry, liquidation, current ?? 0);

  // About four intervals, ending on the first tick at or above the top price.
  const { step, minor, decimals: tickDecimals } = niceStep(top / 4);
  const max = Math.ceil(top / step - 1e-9) * step;
  const majors = Math.round(max / step);
  const ticks: RulerTick[] = [];
  for (let i = 0; i <= majors; i++) {
    const value = i * step;
    const last = i === majors;
    ticks.push({
      at: clamp01(value / max),
      major: true,
      label: formatNumber(value, tickDecimals) + (last ? ` ${unit}` : ''),
      // Keep the first and the last label; drop every second one in between.
      alt: !last && i % 2 === 1,
    });
    if (last) break;
    for (let j = 1; j < minor; j++) {
      ticks.push({ at: clamp01((value + (j * step) / minor) / max), major: false, label: '', alt: false });
    }
  }

  const gap = Math.abs(entry - liquidation);
  const distance = gap / entry;
  const price = (n: number) => formatNumber(n, decimals);
  const entryDecimals =
    options.entryDecimals === 'auto' ? neededDecimals(entry, decimals) : (options.entryDecimals ?? decimals);
  const entryText = formatNumber(entry, entryDecimals);
  const pct = formatPercent(distance);

  let summary = fmt(side === 'long' ? strings.summaryLong : strings.summaryShort, {
    entry: entryText,
    liq: price(liquidation),
    gap: price(gap),
    pct,
    unit,
  });
  if (current !== null) {
    const left = side === 'long' ? (current - liquidation) / current : (liquidation - current) / current;
    summary +=
      ' ' +
      fmt(left > 0 ? strings.summaryCurrent : strings.summaryPast, {
        current: price(current),
        pct: formatPercent(Math.max(0, left)),
        unit,
      });
  }
  summary += ' ' + strings.scale;

  return {
    ok: true,
    side,
    max,
    ticks,
    entryAt: clamp01(entry / max),
    liqAt: clamp01(liquidation / max),
    currentAt: current === null ? null : clamp01(current / max),
    gapFrom: clamp01(Math.min(entry, liquidation) / max),
    gapLen: clamp01(gap / max),
    distance,
    gap,
    text: {
      side: sideText,
      entry: entryText,
      liquidation: price(liquidation),
      current: current === null ? '' : price(current),
      distance: fmt(strings.distance, { pct }),
      summary,
    },
  };
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Markup of the tick marks and their labels. Used by the component and the updater. */
export function ticksHtml(layout: RulerLayout): string {
  return layout.ticks
    .map((t) => {
      const at = t.at.toFixed(5);
      if (!t.major) return `<span class="rr-tick" style="--at:${at}"></span>`;
      return (
        `<span class="rr-tick major" style="--at:${at}"></span>` +
        `<span class="rr-ticklabel${t.alt ? ' alt' : ''}" style="--at:${at}"><span class="num">${escapeHtml(t.label)}</span></span>`
      );
    })
    .join('');
}

/**
 * Redraw a ruler that RiskRuler.astro rendered.
 *
 *   const ruler = document.querySelector<HTMLElement>('#calc-ruler')!;
 *   updateRiskRuler(ruler, { entry: 68000, liquidation: 64824.4, side: 'long' });
 *
 * Pass a `message` to show the empty state with your own text (for example
 * "This position cannot be liquidated"); otherwise invalid numbers show the
 * default one. Returns the layout, so the caller can reuse the figures.
 */
export function updateRiskRuler(root: HTMLElement, input: RulerInput, message?: string): RulerLayout | null {
  let strings: RulerStrings;
  try {
    strings = JSON.parse(root.dataset.rrStrings || '') as RulerStrings;
  } catch {
    return null; // leave the server-rendered ruler as it is
  }
  const decimals = Number(root.dataset.rrDecimals || 0);
  const entryRaw = root.dataset.rrEntryDecimals;
  const entryDecimals = entryRaw === 'auto' ? 'auto' : entryRaw === undefined || entryRaw === '' ? undefined : Number(entryRaw);
  const layout = layoutRiskRuler(input, strings, { unit: root.dataset.rrUnit || 'USDT', decimals, entryDecimals });
  const part = (name: string) => root.querySelector<HTMLElement>(`[data-rr="${name}"]`);
  const setText = (name: string, text: string) => {
    const el = part(name);
    if (el && el.textContent !== text) el.textContent = text;
  };
  const place = (name: string, at: number | null) => {
    const el = part(name);
    if (!el) return;
    el.hidden = at === null;
    if (at !== null) el.style.setProperty('--at', at.toFixed(5));
  };

  root.dataset.state = layout.ok ? 'ready' : 'empty';
  root.dataset.side = layout.side;
  setText('side', layout.text.side);
  setText('summary', layout.ok ? layout.text.summary : (message ?? layout.text.summary));
  setText('empty', layout.ok ? '' : (message ?? strings.empty));
  setText('distance', layout.text.distance);

  if (!layout.ok) {
    place('entry', null);
    place('liq', null);
    place('current', null);
    const gap = part('gap');
    if (gap) gap.hidden = true;
    return layout;
  }

  root.dataset.entry = String(input.entry);
  root.dataset.liq = String(input.liquidation);
  place('entry', layout.entryAt);
  place('liq', layout.liqAt);
  place('current', layout.currentAt);
  setText('entry-value', layout.text.entry);
  setText('liq-value', layout.text.liquidation);
  setText('current-value', layout.text.current);

  const gap = part('gap');
  if (gap) {
    gap.hidden = false;
    gap.style.setProperty('--from', layout.gapFrom.toFixed(5));
    gap.style.setProperty('--len', layout.gapLen.toFixed(5));
  }

  // The ticks only change when the axis range does.
  const ticks = part('ticks');
  if (ticks && ticks.dataset.max !== String(layout.max)) {
    ticks.innerHTML = ticksHtml(layout);
    ticks.dataset.max = String(layout.max);
  }
  return layout;
}
