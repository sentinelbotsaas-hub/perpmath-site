// Tiny formatting helpers shared by server templates and browser scripts.
// No dependencies; safe to import anywhere.

/**
 * Fill `{name}` placeholders in a UI string.
 *   fmt('Price has to fall {pct}.', { pct: '4.67%' })
 * Unknown placeholders are left as they are, so a typo is visible.
 */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole,
  );
}

/** 64824.4 -> "64,824" (or with decimals: "64,824.4"). Same output in every locale. */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 0.0467 -> "4.67%". */
export function formatPercent(fraction: number, decimals = 2): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Number of decimals a tick size needs: 0.1 -> 1, 0.01 -> 2, 1 -> 0. */
export function tickDecimals(tick: number): number {
  if (!Number.isFinite(tick) || tick <= 0) return 0;
  const s = tick.toString();
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}
