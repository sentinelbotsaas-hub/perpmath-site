// Display helpers for the market pages. They cut already-formatted text into
// the parts a component sets in different faces; they compute nothing.

/**
 * A leverage figure for a place that prints the number large and its unit
 * small beside it. The template is the `lev` string of src/i18n/daily.ts:
 *   '{n} 倍' and 20 -> { value: '20', unit: '倍' }
 *   '{n}x'  and 20 -> { value: '20x' }   (no space in the template: one piece)
 * `none` is printed when there is no leverage to show.
 */
/** The value of data-tone for a signed figure: green above zero, red below, nothing at zero. */
export function signTone(value: number | null | undefined): 'positive' | 'negative' | undefined {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return undefined;
  return value > 0 ? 'positive' : 'negative';
}

/** value / max as a CSS number for --depth, 0 to 1. A max of 0 gives 0. */
export function depthShare(value: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return '0';
  return Math.min(1, Math.max(0, Math.abs(value) / max)).toFixed(4);
}

export function leverageFigure(template: string, n: number | null, none: string): { value: string; unit?: string } {
  if (n === null) return { value: none };
  const [before = '', after = ''] = template.split('{n}');
  if (before === '' && after.startsWith(' ') && after.trim() !== '') {
    return { value: String(n), unit: after.trim() };
  }
  return { value: `${before}${n}${after}` };
}
