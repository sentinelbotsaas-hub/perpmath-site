// The risk ruler must stay honest: a linear axis from 0, marks at the true
// share of the price, and a sentence that says the same thing as the picture.
import { describe, expect, it } from 'vitest';
import { layoutRiskRuler, ticksHtml } from './risk-ruler';
import type { RulerStrings } from './risk-ruler';

const strings: RulerStrings = {
  entry: 'Entry',
  liquidation: 'Liquidation',
  current: 'Now',
  long: 'Long',
  short: 'Short',
  distance: '{pct} to liquidation',
  summaryLong: 'Long from {entry} {unit}, liquidation at {liq} {unit}. Falls {pct} ({gap} {unit}).',
  summaryShort: 'Short from {entry} {unit}, liquidation at {liq} {unit}. Rises {pct} ({gap} {unit}).',
  summaryCurrent: 'Now {current} {unit}, {pct} away.',
  summaryPast: 'Now {current} {unit}, past liquidation.',
  scale: 'Axis starts at 0.',
  empty: 'Nothing to draw.',
};

describe('layoutRiskRuler', () => {
  it('draws a long position to scale from 0', () => {
    const r = layoutRiskRuler({ entry: 68000, liquidation: 64824.4, side: 'long' }, strings, { decimals: 1 });
    expect(r.ok).toBe(true);
    expect(r.max).toBe(80000);
    expect(r.entryAt).toBeCloseTo(68000 / 80000, 10);
    expect(r.liqAt).toBeCloseTo(64824.4 / 80000, 10);
    // The band starts at the lower price and is exactly as long as the gap.
    expect(r.gapFrom).toBeCloseTo(r.liqAt, 10);
    expect(r.gapLen).toBeCloseTo(r.entryAt - r.liqAt, 10);
    expect(r.distance).toBeCloseTo(3175.6 / 68000, 10);
    expect(r.text.distance).toBe('4.67% to liquidation');
    expect(r.text.summary).toBe(
      'Long from 68,000.0 USDT, liquidation at 64,824.4 USDT. Falls 4.67% (3,175.6 USDT). Axis starts at 0.',
    );
  });

  it('puts the liquidation mark above the entry mark for a short', () => {
    const r = layoutRiskRuler({ entry: 68000, liquidation: 69135.6, side: 'short' }, strings, { decimals: 1 });
    expect(r.liqAt).toBeGreaterThan(r.entryAt);
    expect(r.gapFrom).toBeCloseTo(r.entryAt, 10);
    expect(r.text.summary).toContain('Short from 68,000.0 USDT');
    expect(r.text.summary).toContain('Rises 1.67%');
  });

  it('keeps every mark inside the axis, whatever the prices', () => {
    for (const [entry, liquidation, current] of [
      [68000, 64824.4, 67000],
      [68000, 135000, 140000],
      [0.5123, 0.4011, 0.6],
      [3, 2.999, 3],
      [100000, 99330, null],
    ] as Array<[number, number, number | null]>) {
      const r = layoutRiskRuler({ entry, liquidation, side: liquidation < entry ? 'long' : 'short', current }, strings);
      expect(r.ok).toBe(true);
      for (const at of [r.entryAt, r.liqAt, r.currentAt ?? 0, r.gapFrom, r.gapFrom + r.gapLen]) {
        expect(at).toBeGreaterThanOrEqual(0);
        expect(at).toBeLessThanOrEqual(1 + 1e-9);
      }
      expect(r.max).toBeGreaterThanOrEqual(Math.max(entry, liquidation, current ?? 0));
    }
  });

  it('starts the ticks at 0 and ends them on the axis maximum, with the unit on the last label', () => {
    const r = layoutRiskRuler({ entry: 68000, liquidation: 64824.4, side: 'long' }, strings);
    const majors = r.ticks.filter((t) => t.major);
    expect(majors.map((t) => t.label)).toEqual(['0', '20,000', '40,000', '60,000', '80,000 USDT']);
    expect(majors[0].at).toBe(0);
    expect(majors[majors.length - 1].at).toBe(1);
    // Ticks are evenly spaced: the axis is linear.
    const gaps = majors.slice(1).map((t, i) => t.at - majors[i].at);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 10);
    // The first and last labels always stay; every second one in between may be dropped.
    expect(majors.map((t) => t.alt)).toEqual([false, true, false, true, false]);
  });

  it('labels small prices with enough decimals', () => {
    const r = layoutRiskRuler({ entry: 0.5123, liquidation: 0.4011, side: 'long' }, strings, { decimals: 4 });
    const labels = r.ticks.filter((t) => t.major).map((t) => t.label);
    expect(labels[0]).toBe('0.0');
    expect(labels[1]).toBe('0.2');
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('prints the entry price with its own decimals when asked, and the same everywhere', () => {
    const input = { entry: 68000, liquidation: 64824.4, side: 'long' as const };
    // Default: the entry follows `decimals`, as before.
    expect(layoutRiskRuler(input, strings, { decimals: 1 }).text.entry).toBe('68,000.0');
    // A fixed number: the home hero prints the entry as a whole number.
    const fixed = layoutRiskRuler(input, strings, { decimals: 1, entryDecimals: 0 });
    expect(fixed.text.entry).toBe('68,000');
    expect(fixed.text.liquidation).toBe('64,824.4');
    expect(fixed.text.summary).toContain('Long from 68,000 USDT, liquidation at 64,824.4 USDT.');
    // "auto": as few decimals as the entry needs, never more than `decimals`.
    const auto = (entry: number, decimals: number) =>
      layoutRiskRuler({ ...input, entry }, strings, { decimals, entryDecimals: 'auto' }).text.entry;
    expect(auto(68000, 1)).toBe('68,000');
    expect(auto(68000.5, 1)).toBe('68,000.5');
    expect(auto(68000.25, 1)).toBe('68,000.3');
    expect(auto(0.512, 4)).toBe('0.512');
    expect(auto(68000, 0)).toBe('68,000');
    // The drawing itself does not depend on how the entry is printed.
    const plain = layoutRiskRuler(input, strings, { decimals: 1 });
    expect(fixed.entryAt).toBe(plain.entryAt);
    expect(fixed.distance).toBe(plain.distance);
    expect(fixed.gap).toBe(plain.gap);
  });

  it('describes the current price, also when it is already past liquidation', () => {
    const near = layoutRiskRuler({ entry: 68000, liquidation: 64000, side: 'long', current: 66000 }, strings);
    expect(near.currentAt).toBeCloseTo(66000 / near.max, 10);
    expect(near.text.summary).toContain('Now 66,000 USDT, 3.03% away.');
    const past = layoutRiskRuler({ entry: 68000, liquidation: 64000, side: 'long', current: 63000 }, strings);
    expect(past.text.summary).toContain('Now 63,000 USDT, past liquidation.');
    const short = layoutRiskRuler({ entry: 68000, liquidation: 70000, side: 'short', current: 71000 }, strings);
    expect(short.text.summary).toContain('past liquidation');
  });

  it('refuses numbers it cannot draw instead of drawing something wrong', () => {
    for (const [entry, liquidation] of [
      [68000, 0],
      [68000, -5],
      [68000, Number.NaN],
      [0, 100],
      [Number.POSITIVE_INFINITY, 100],
    ]) {
      const r = layoutRiskRuler({ entry, liquidation, side: 'long' }, strings);
      expect(r.ok).toBe(false);
      expect(r.ticks).toEqual([]);
      expect(r.text.summary).toBe('Nothing to draw.');
    }
  });

  it('ignores a current price that is not a number above 0', () => {
    for (const current of [0, -1, Number.NaN, null, undefined]) {
      const r = layoutRiskRuler({ entry: 68000, liquidation: 64000, side: 'long', current }, strings);
      expect(r.currentAt).toBeNull();
      expect(r.text.summary).not.toContain('Now');
    }
  });
});

describe('ticksHtml', () => {
  it('renders one mark per tick and one label per major tick', () => {
    const r = layoutRiskRuler({ entry: 68000, liquidation: 64824.4, side: 'long' }, strings);
    const html = ticksHtml(r);
    expect(html.match(/class="rr-tick( major)?"/g)?.length).toBe(r.ticks.length);
    expect(html.match(/class="rr-ticklabel/g)?.length).toBe(r.ticks.filter((t) => t.major).length);
    expect(html).toContain('80,000 USDT');
  });

  it('escapes the unit', () => {
    const r = layoutRiskRuler({ entry: 10, liquidation: 9, side: 'long' }, strings, { unit: '<b>' });
    expect(ticksHtml(r)).not.toContain('<b>');
  });
});
