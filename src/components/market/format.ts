// Display helpers for the market pages. They cut already-formatted text into
// the parts a component sets in different faces; they compute nothing.

/**
 * A leverage figure for a place that prints the number large and its unit
 * small beside it. The template is the `lev` string of src/i18n/daily.ts:
 *   '{n} 倍' and 20 -> { value: '20', unit: '倍' }
 *   '{n}x'  and 20 -> { value: '20x' }   (no space in the template: one piece)
 * `none` is printed when there is no leverage to show.
 */
export function leverageFigure(template: string, n: number | null, none: string): { value: string; unit?: string } {
  if (n === null) return { value: none };
  const [before = '', after = ''] = template.split('{n}');
  if (before === '' && after.startsWith(' ') && after.trim() !== '') {
    return { value: String(n), unit: after.trim() };
  }
  return { value: `${before}${n}${after}` };
}
