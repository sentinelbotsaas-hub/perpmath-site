// Geometry for the market charts. The charts are inline SVG drawn at build
// time from src/data/market/*.json; nothing here invents or smooths a value.
// Pure and dependency-free.
//
// A chart is a 100 x 100 box stretched to its frame (preserveAspectRatio
// "none"), so every position is a share of the plot: x from the left, y from
// the top. Text is never put inside the SVG; axis labels are HTML placed with
// the same shares (see Plot.astro).

export interface Axis {
  min: number;
  max: number;
  step: number;
  /** Tick values from min to max, both included. */
  ticks: number[];
  /** Decimals needed to print a tick without rounding it. */
  decimals: number;
}

/**
 * A value axis with round tick values that covers lo..hi.
 * `target` is roughly how many steps to aim for.
 */
export function niceAxis(lo: number, hi: number, target = 4): Axis {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw new Error('axis bounds must be finite numbers');
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) {
    const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.01 : 1;
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / Math.max(1, target);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  // Binary rounding can turn an exact 2 into 2.0000000000000004.
  const fits = (n: number) => normalized <= n + 1e-9;
  const nice = fits(1) ? 1 : fits(2) ? 2 : fits(2.5) ? 2.5 : fits(5) ? 5 : 10;
  const step = nice * magnitude;
  const exponent = Math.floor(Math.log10(step) + 1e-9);
  const decimals = Math.max(0, -exponent + (nice === 2.5 ? 1 : 0));
  const round = (n: number) => Number(n.toFixed(decimals + 2));
  // The small epsilon keeps a bound that already sits on a tick from gaining a step.
  const first = Math.floor(lo / step + 1e-9);
  const last = Math.ceil(hi / step - 1e-9);
  const ticks: number[] = [];
  for (let i = first; i <= last; i++) ticks.push(round(i * step));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks, decimals };
}

/**
 * The round axis that wastes the least room: of the candidates with at most
 * `maxTicks` ticks, the one with the shortest span. When two spans are equal
 * the one with more ticks wins, so the reader gets more labelled values.
 */
export function tightAxis(lo: number, hi: number, maxTicks = 6): Axis {
  let best: Axis | undefined;
  for (let target = 2; target <= 8; target++) {
    const axis = niceAxis(lo, hi, target);
    if (axis.ticks.length > maxTicks) continue;
    const span = axis.max - axis.min;
    const bestSpan = best ? best.max - best.min : Number.POSITIVE_INFINITY;
    const same = Math.abs(span - bestSpan) <= 1e-12 * Math.max(1, Math.abs(span));
    if ((!same && span < bestSpan) || (same && best && axis.ticks.length > best.ticks.length)) {
      best = axis;
    }
  }
  return best ?? niceAxis(lo, hi, 2);
}

/** Share of the axis at which `value` sits: 0 at min, 1 at max. */
export function share(value: number, axis: Pick<Axis, 'min' | 'max'>): number {
  return (value - axis.min) / (axis.max - axis.min);
}

/** SVG y for a value: 0 is the top of the plot, 100 the bottom. */
export function yOf(value: number, axis: Pick<Axis, 'min' | 'max'>): number {
  return Number(((1 - share(value, axis)) * 100).toFixed(3));
}

/** Centre of slot `index` out of `count` equal slots, 0 to 100 from the left. */
export function slotCentre(index: number, count: number): number {
  return Number((((index + 0.5) / count) * 100).toFixed(3));
}

/** "x,y x,y ..." for a polyline through one value per slot. */
export function linePoints(values: readonly number[], axis: Pick<Axis, 'min' | 'max'>): string {
  return values.map((value, i) => `${slotCentre(i, values.length)},${yOf(value, axis)}`).join(' ');
}

/** Index of the largest and of the smallest value. Ties go to the earliest. */
export function extremes(values: readonly number[]): { max: number; min: number } {
  let max = 0;
  let min = 0;
  values.forEach((value, i) => {
    if (value > values[max]) max = i;
    if (value < values[min]) min = i;
  });
  return { max, min };
}

/**
 * Which labels of a set of horizontal lines can be printed without running
 * into each other. `shares` are positions on the value axis (0 to 1); a label
 * is kept when it is at least `gap` away from every label kept before it.
 * Order the input by importance: earlier entries win.
 */
export function spacedLabels(shares: readonly number[], gap: number): boolean[] {
  const kept: number[] = [];
  return shares.map((s) => {
    if (kept.some((k) => Math.abs(k - s) < gap)) return false;
    kept.push(s);
    return true;
  });
}
