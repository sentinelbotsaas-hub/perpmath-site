// The bars are only as honest as their layout: both start at 0, share one
// linear axis, and the axis says what its full width stands for.
import { describe, expect, it } from 'vitest';
import { barsTicksHtml, layoutScaleBars } from './scale-bars';

describe('layoutScaleBars', () => {
  it('ends the axis on the first nice tick at or above the longer bar', () => {
    const l = layoutScaleBars({ a: 0.05, b: 0.0522555 });
    expect(l.ok).toBe(true);
    expect(l.max).toBeCloseTo(0.06, 12);
    expect(l.maxLabel).toBe('6%');
    expect(l.ticks.map((t) => t.label)).toEqual(['0%', '2%', '4%', '6%']);
  });

  it('keeps the two bars at the true ratio of the two numbers', () => {
    const l = layoutScaleBars({ a: 0.02, b: 0.0967 });
    expect(l.aShare / l.bShare).toBeCloseTo(0.02 / 0.0967, 10);
    expect(l.aShare).toBeCloseTo(0.02 / l.max, 10);
  });

  it('uses the given end of the axis and labels it like a result', () => {
    // A 70% drawdown needs +233.33%: the calc library says the scale is 2.3333.
    const l = layoutScaleBars({ a: 0.7, b: 7 / 3, max: 7 / 3 });
    expect(l.maxLabel).toBe('233.33%');
    expect(l.bShare).toBeCloseTo(1, 10);
    expect(l.aShare).toBeCloseTo(0.3, 10);
    expect(l.ticks.map((t) => t.label)).toEqual(['0%', '100%', '200%']);
    expect(l.ticks[1].at).toBeCloseTo(3 / 7, 10);
  });

  it('puts the last tick on the end when the given end is a round number', () => {
    const l = layoutScaleBars({ a: 0.5, b: 1, max: 1 });
    expect(l.ticks.map((t) => t.label)).toEqual(['0%', '25%', '50%', '75%', '100%']);
    expect(l.ticks.at(-1)?.at).toBe(1);
  });

  it('prints fractional steps without rounding them away', () => {
    expect(layoutScaleBars({ a: 0.004, b: 0.0067 }).ticks.map((t) => t.label)).toEqual(['0%', '0.2%', '0.4%', '0.6%', '0.8%']);
    expect(layoutScaleBars({ a: 0.006, b: 0.0095 }).ticks.map((t) => t.label)).toEqual(['0%', '0.25%', '0.50%', '0.75%', '1.00%']);
  });

  it('handles distances above 100% of the entry price', () => {
    const l = layoutScaleBars({ a: 2, b: 0.9967 });
    expect(l.max).toBe(2);
    expect(l.aShare).toBe(1);
    expect(l.ticks.at(-1)?.label).toBe('200%');
  });

  it('never extends a bar past the axis', () => {
    const l = layoutScaleBars({ a: 3, b: 0.5, max: 1 });
    expect(l.aShare).toBe(1);
  });

  it('has nothing to draw for unusable numbers', () => {
    for (const input of [
      { a: Number.NaN, b: 0.1 },
      { a: 0.1, b: Number.POSITIVE_INFINITY },
      { a: -0.1, b: 0.1 },
      { a: 0, b: 0 },
    ]) {
      const l = layoutScaleBars(input);
      expect(l.ok).toBe(false);
      expect(l.ticks).toEqual([]);
      expect(l.aShare).toBe(0);
      expect(l.bShare).toBe(0);
    }
  });

  it('draws one zero-length bar next to a real one', () => {
    const l = layoutScaleBars({ a: 0, b: 0.1 });
    expect(l.ok).toBe(true);
    expect(l.aShare).toBe(0);
  });
});

describe('barsTicksHtml', () => {
  it('renders one mark and one label per tick', () => {
    const html = barsTicksHtml(layoutScaleBars({ a: 0.05, b: 0.052 }));
    expect(html.match(/calc-bars-tick"/g)?.length).toBe(4);
    expect(html.match(/calc-bars-ticklabel"/g)?.length).toBe(4);
    expect(html).toContain('>6%<');
  });

  it('is empty when there is nothing to draw', () => {
    expect(barsTicksHtml(layoutScaleBars({ a: Number.NaN, b: 1 }))).toBe('');
  });
});
