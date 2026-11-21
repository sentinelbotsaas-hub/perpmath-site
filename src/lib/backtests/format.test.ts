import { describe, expect, it } from 'vitest';
import {
  MINUS,
  exclusiveEnd,
  formatCount,
  formatDay,
  formatMoney,
  formatParam,
  formatPct,
  formatPlus,
  formatPlusPct,
  formatRate,
  formatSigned,
  formatUtc,
  intervalMinutes,
} from './format';

// Hand-made values. A loss is written with the real minus sign (U+2212) and
// nothing else: no colour, no brackets, no plus sign on gains.
describe('formatPlus', () => {
  it('puts a plus sign on a gain and the real minus sign on a loss', () => {
    expect(formatPlus(3.1659)).toBe('+3.17');
    expect(formatPlus(-29.2964)).toBe('−29.30');
    expect(formatPlus(1366.5466)).toBe('+1,366.55');
    expect(formatPlusPct(4.3692)).toBe('+4.37%');
    expect(formatPlusPct(-1.1168)).toBe('−1.12%');
  });

  it('gives zero, and anything that rounds to zero, no sign', () => {
    expect(formatPlus(0)).toBe('0.00');
    expect(formatPlus(0.004)).toBe('0.00');
    expect(formatPlus(-0.004)).toBe('0.00');
    expect(formatPlusPct(0)).toBe('0.00%');
  });

  it('keeps a value that was not computed as null', () => {
    expect(formatPlus(null)).toBeNull();
    expect(formatPlusPct(null)).toBeNull();
    expect(formatPlus(Number.NaN)).toBeNull();
  });
});

describe('formatSigned', () => {
  it('uses the real minus sign', () => {
    expect(MINUS).toBe('−');
    expect(formatSigned(-0.5692)).toBe('−0.57');
    expect(formatSigned(-10.914)).toBe('−10.91');
  });

  it('writes gains without a plus sign', () => {
    expect(formatSigned(0.5692)).toBe('0.57');
    expect(formatSigned(2)).toBe('2.00');
  });

  it('never prints a negative zero', () => {
    expect(formatSigned(-0.004)).toBe('0.00');
    expect(formatSigned(-0)).toBe('0.00');
    expect(formatSigned(0)).toBe('0.00');
  });

  it('keeps a small loss that survives rounding', () => {
    expect(formatSigned(-0.0542)).toBe('−0.05');
    expect(formatSigned(-0.006)).toBe('−0.01');
  });

  it('groups thousands and honours the number of decimals', () => {
    expect(formatSigned(-12345.678, 1)).toBe('−12,345.7');
    expect(formatSigned(1639, 0)).toBe('1,639');
  });

  it('returns null, not a zero, for a value that was not computed', () => {
    expect(formatSigned(null)).toBeNull();
    expect(formatSigned(Number.NaN)).toBeNull();
    expect(formatSigned(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('formatPct', () => {
  it('takes a value that is already a percentage', () => {
    expect(formatPct(31.4607)).toBe('31.46%');
    expect(formatPct(-42.8564)).toBe('−42.86%');
    expect(formatPct(100)).toBe('100.00%');
    expect(formatPct(66.9656, 1)).toBe('67.0%');
  });

  it('returns null for a value that was not computed', () => {
    expect(formatPct(null)).toBeNull();
  });

  it('rounds the stored value the way the engine prints it', () => {
    // -66.945 is stored as -66.94499999999999...; the engine's table says -66.94
    expect(formatPct(-66.945)).toBe('−66.94%');
    expect(formatPct(-93.9772)).toBe('−93.98%');
    expect(formatPct(20.8042)).toBe('20.80%');
  });
});

describe('formatCount and formatMoney', () => {
  it('formats trade counts', () => {
    expect(formatCount(801)).toBe('801');
    expect(formatCount(1639)).toBe('1,639');
    expect(formatCount(35040)).toBe('35,040');
    expect(formatCount(0)).toBe('0');
  });

  it('formats money with two decimals unless it is a whole number', () => {
    expect(formatMoney(3305.5)).toBe('3,305.50');
    expect(formatMoney(602.28)).toBe('602.28');
    expect(formatMoney(10000)).toBe('10,000');
    expect(formatMoney(-250.5)).toBe('−250.50');
  });
});

describe('formatRate', () => {
  it('turns a fraction into a percentage without padding zeros', () => {
    expect(formatRate(0.00055)).toBe('0.055%');
    expect(formatRate(0.0002)).toBe('0.02%');
    expect(formatRate(1)).toBe('100%');
    expect(formatRate(0.5)).toBe('50%');
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(-0.0001)).toBe('−0.01%');
  });
});

describe('formatParam', () => {
  it('prints a config value as it is written in the config file', () => {
    expect(formatParam(2)).toBe('2');
    expect(formatParam(0.5)).toBe('0.5');
    expect(formatParam(96)).toBe('96');
    expect(formatParam(-1.5)).toBe('−1.5');
    expect(formatParam(null)).toBeNull();
  });
});

describe('dates', () => {
  it('formats engine timestamps as UTC', () => {
    expect(formatDay('2025-11-18T11:30:00Z')).toBe('2025-11-18');
    expect(formatUtc('2025-11-18T11:30:00Z')).toBe('2025-11-18 11:30 UTC');
    expect(formatUtc('2026-07-31T00:00:00Z')).toBe('2026-07-31 00:00 UTC');
  });

  it('refuses a timestamp that is not in the engine format', () => {
    expect(() => formatDay('2025-11-18')).toThrow();
    expect(() => formatUtc('18/11/2025 11:30')).toThrow();
  });

  it('knows how long a bar is', () => {
    expect(intervalMinutes('15m')).toBe(15);
    expect(intervalMinutes('4h')).toBe(240);
    expect(intervalMinutes('1d')).toBe(1440);
    expect(() => intervalMinutes('15')).toThrow();
    expect(() => intervalMinutes('1w')).toThrow();
  });

  it('finds the exclusive end of a range: one bar after the last bar opens', () => {
    expect(exclusiveEnd('2026-11-18T11:15:00Z', '15m')).toBe('2026-11-18T11:30:00Z');
    expect(exclusiveEnd('2026-12-31T20:00:00Z', '4h')).toBe('2027-01-01T00:00:00Z');
    expect(exclusiveEnd('2026-02-28T00:00:00Z', '1d')).toBe('2026-03-01T00:00:00Z');
  });
});
