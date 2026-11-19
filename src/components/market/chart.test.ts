import { describe, expect, it } from 'vitest';
import { extremes, linePoints, niceAxis, share, slotCentre, spacedLabels, tightAxis, yOf } from './chart';

describe('niceAxis', () => {
  it('covers the data with round ticks', () => {
    const axis = niceAxis(60980.292, 72365.08);
    expect(axis.min).toBeLessThanOrEqual(60980.292);
    expect(axis.max).toBeGreaterThanOrEqual(72365.08);
    expect(axis.ticks).toEqual([60000, 65000, 70000, 75000]);
    expect(axis.decimals).toBe(0);
  });

  it('keeps a bound that already sits on a tick', () => {
    const axis = niceAxis(0, 0.03, 3);
    expect(axis.ticks).toEqual([0, 0.01, 0.02, 0.03]);
    expect(axis.decimals).toBe(2);
  });

  it('spans zero when the data does', () => {
    const axis = niceAxis(-0.0298, 0.03);
    expect(axis.ticks).toContain(0);
    expect(axis.min).toBeLessThanOrEqual(-0.0298);
    expect(axis.max).toBeGreaterThanOrEqual(0.03);
  });

  it('prints 2.5 steps with one more decimal', () => {
    const axis = niceAxis(0, 10);
    expect(axis.step).toBe(2.5);
    expect(axis.decimals).toBe(1);
    expect(axis.ticks).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('widens a flat series instead of dividing by zero', () => {
    const axis = niceAxis(5, 5);
    expect(axis.max).toBeGreaterThan(axis.min);
    expect(share(5, axis)).toBeGreaterThan(0);
    expect(share(5, axis)).toBeLessThan(1);
  });

  it('refuses a value that is not a number', () => {
    expect(() => niceAxis(Number.NaN, 1)).toThrow();
  });
});

describe('tightAxis', () => {
  it('picks the shortest round span within the tick budget', () => {
    const axis = tightAxis(-12.37, 12.52, 7);
    expect(axis.ticks).toEqual([-15, -10, -5, 0, 5, 10, 15]);
  });

  it('prefers more labelled values when two spans are equal', () => {
    // -10..10 fits both a step of 10 (3 ticks) and a step of 5 (5 ticks).
    expect(tightAxis(-7.34, 9, 7).ticks).toEqual([-10, -5, 0, 5, 10]);
  });

  it('never returns more ticks than asked for', () => {
    for (const [lo, hi] of [
      [0.0029, 0.0298],
      [716821.98, 835807.35],
      [72.15, 75.6],
      [57.35, 79.97],
    ]) {
      const axis = tightAxis(lo, hi, 6);
      expect(axis.ticks.length).toBeLessThanOrEqual(6);
      expect(axis.min).toBeLessThanOrEqual(lo);
      expect(axis.max).toBeGreaterThanOrEqual(hi);
    }
  });
});

describe('positions', () => {
  const axis = { min: 0, max: 200 };

  it('puts the minimum at the bottom and the maximum at the top', () => {
    expect(yOf(0, axis)).toBe(100);
    expect(yOf(200, axis)).toBe(0);
    expect(yOf(50, axis)).toBe(75);
  });

  it('centres each slot', () => {
    expect(slotCentre(0, 4)).toBe(12.5);
    expect(slotCentre(3, 4)).toBe(87.5);
  });

  it('draws one point per value, in order', () => {
    expect(linePoints([0, 200], axis)).toBe('25,100 75,0');
  });

  it('finds the earliest largest and smallest value', () => {
    expect(extremes([3, 9, 1, 9, 1])).toEqual({ max: 1, min: 2 });
  });
});

describe('spacedLabels', () => {
  it('drops a label that would sit on an earlier one', () => {
    expect(spacedLabels([0.5, 0.52, 0.7], 0.05)).toEqual([true, false, true]);
  });

  it('keeps everything when there is room', () => {
    expect(spacedLabels([0.1, 0.4, 0.9], 0.05)).toEqual([true, true, true]);
  });
});
