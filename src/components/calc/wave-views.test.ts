// Display helpers added with the DCA, futures profit and Sharpe ratio
// calculators: signed figures, the share bars and the interval axis. They
// format and lay out numbers; none of them computes a result.
import { describe, expect, it } from 'vitest';
import { FILLS_TICKS, fillsRowsHtml, fillsTicksHtml } from './fills-bars';
import { intervalTicksHtml, layoutInterval } from './interval-axis';
import { signed, signedPercent, toneOf, trimmed } from './signed';

describe('signed', () => {
  it('prints the sign with the number, with a real minus sign', () => {
    expect(signed(190.37)).toBe('+190.37');
    expect(signed(-225.71)).toBe('−225.71');
    expect(signed(-1234.5)).toBe('−1,234.50');
    expect(signed(0)).toBe('0.00');
  });

  it('gives no sign to a value that rounds to zero', () => {
    expect(signed(-0.001)).toBe('0.00');
    expect(signed(0.004)).toBe('0.00');
    expect(signed(-0.005, 3)).toBe('−0.005');
  });

  it('can leave the plus out', () => {
    expect(signed(1.53, 2, false)).toBe('1.53');
    expect(signed(-0.52, 2, false)).toBe('−0.52');
  });

  it('signedPercent takes a fraction', () => {
    expect(signedPercent(0.0323)).toBe('+3.23%');
    expect(signedPercent(-0.4514)).toBe('−45.14%');
    expect(signedPercent(0)).toBe('0.00%');
    expect(signedPercent(0.011833, 4)).toBe('+1.1833%');
  });
});

describe('toneOf', () => {
  it('follows the printed sign', () => {
    expect(toneOf(5)).toBe('positive');
    expect(toneOf(-5)).toBe('negative');
    expect(toneOf(0)).toBeUndefined();
    expect(toneOf(-0.001)).toBeUndefined(); // prints as 0.00
    expect(toneOf(-0.001, 3)).toBe('negative');
    expect(toneOf(Number.NaN)).toBeUndefined();
  });
});

describe('trimmed', () => {
  it('drops trailing zeros and keeps the separators', () => {
    expect(trimmed(64000, 1)).toBe('64,000');
    expect(trimmed(65333.3, 1)).toBe('65,333.3');
    expect(trimmed(35.29411, 4)).toBe('35.2941');
    expect(trimmed(0.04, 6)).toBe('0.04');
    expect(trimmed(100, 0)).toBe('100');
    expect(trimmed(1200, 2)).toBe('1,200');
  });
});

describe('fills bars', () => {
  it('draws one bar per row at its share', () => {
    const html = fillsRowsHtml([
      { name: 'Fill 1', price: '68,000', value: '25.00%', share: 0.25 },
      { name: 'Fill 2', price: '62,000', value: '75.00%', share: 0.75 },
    ]);
    expect(html.match(/calc-fills-row/g)).toHaveLength(2);
    expect(html).toContain('--value:0.2500');
    expect(html).toContain('--value:0.7500');
    expect(html).toContain('Fill 1');
    expect(html).toContain('75.00%');
  });

  it('never draws a bar outside the scale, and draws nothing for a share that is not a number', () => {
    const html = fillsRowsHtml([
      { name: 'a', price: '1', value: 'x', share: 1.7 },
      { name: 'b', price: '1', value: 'x', share: -0.2 },
      { name: 'c', price: '1', value: 'x', share: Number.NaN },
    ]);
    expect(html).toContain('--value:1.0000');
    expect(html.match(/--value:0\.0000/g)).toHaveLength(2);
    expect(html).not.toContain('NaN');
  });

  it('escapes what a reader typed', () => {
    const html = fillsRowsHtml([{ name: 'Fill 1', price: '<b>"x"</b>&', value: '1%', share: 0.01 }]);
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt;&amp;');
  });

  it('has a fixed scale from 0% to 100%', () => {
    expect(FILLS_TICKS).toEqual([0, 0.25, 0.5, 0.75, 1]);
    const html = fillsTicksHtml();
    for (const label of ['>0%<', '>25%<', '>50%<', '>75%<', '>100%<']) expect(html).toContain(label);
  });
});

describe('layoutInterval', () => {
  it('lays out the opening example of the Sharpe calculator', () => {
    // interval -0.523 to 3.584 around 1.530: axis -1 to 4 in steps of 1
    const layout = layoutInterval({ low: -0.5231668726, high: 3.5836124995, point: 1.5302228135 });
    expect(layout.ok).toBe(true);
    expect(layout.min).toBe(-1);
    expect(layout.max).toBe(4);
    expect(layout.ticks.map((t) => t.label)).toEqual(['−1', '0', '1', '2', '3', '4']);
    expect(layout.zero).toBeCloseTo(0.2, 12);
    expect(layout.from).toBeCloseTo((-0.5231668726 + 1) / 5, 12);
    expect(layout.to).toBeCloseTo((3.5836124995 + 1) / 5, 12);
    expect(layout.point).toBeCloseTo((1.5302228135 + 1) / 5, 12);
  });

  it('always has zero on the axis, as a labelled tick', () => {
    for (const input of [
      { low: 0.4, high: 0.9, point: 0.65 }, // all above zero
      { low: -3.1, high: -0.2, point: -1.6 }, // all below zero
      { low: -0.02, high: 0.05, point: 0.015 }, // tiny
      { low: -40, high: 310, point: 135 }, // large
    ]) {
      const layout = layoutInterval(input);
      expect(layout.ok).toBe(true);
      expect(layout.min).toBeLessThanOrEqual(Math.min(input.low, 0));
      expect(layout.max).toBeGreaterThanOrEqual(Math.max(input.high, 0));
      expect(layout.ticks.some((t) => t.label === '0')).toBe(true);
      expect(layout.ticks[0].at).toBe(0);
      expect(layout.ticks[layout.ticks.length - 1].at).toBe(1);
      expect(layout.ticks.length).toBeGreaterThanOrEqual(3);
      expect(layout.ticks.length).toBeLessThanOrEqual(8);
      for (const at of [layout.from, layout.to, layout.point, layout.zero]) {
        expect(at).toBeGreaterThanOrEqual(0);
        expect(at).toBeLessThanOrEqual(1);
      }
      expect(layout.from).toBeLessThan(layout.to);
    }
  });

  it('keeps positions linear: equal distances on the axis are equal differences in value', () => {
    const layout = layoutInterval({ low: 0.4, high: 0.9, point: 0.65 });
    const span = layout.max - layout.min;
    expect(layout.to - layout.from).toBeCloseTo(0.5 / span, 12);
    expect(layout.point - layout.from).toBeCloseTo(0.25 / span, 12);
  });

  it('prints fractional ticks with the decimals they need', () => {
    const layout = layoutInterval({ low: -0.02, high: 0.05, point: 0.015 });
    expect(layout.ticks.map((t) => t.label)).toEqual(['−0.02', '0', '0.02', '0.04', '0.06']);
  });

  it('has nothing to draw for numbers that are not finite or an interval of no length', () => {
    expect(layoutInterval({ low: Number.NaN, high: 1, point: 0 }).ok).toBe(false);
    expect(layoutInterval({ low: 0, high: Number.POSITIVE_INFINITY, point: 0 }).ok).toBe(false);
    expect(layoutInterval({ low: 1, high: 1, point: 1 }).ok).toBe(false);
    expect(layoutInterval({ low: 2, high: 1, point: 1.5 }).ok).toBe(false);
    expect(intervalTicksHtml(layoutInterval({ low: Number.NaN, high: 1, point: 0 }))).toBe('');
  });

  it('draws a tick mark and a label for every tick', () => {
    const layout = layoutInterval({ low: -0.52, high: 3.58, point: 1.53 });
    const html = intervalTicksHtml(layout);
    expect(html.match(/calc-span-tick"/g)).toHaveLength(layout.ticks.length);
    expect(html.match(/calc-span-ticklabel/g)).toHaveLength(layout.ticks.length);
  });
});
