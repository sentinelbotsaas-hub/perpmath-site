import { describe, expect, it } from 'vitest';
import {
  MAX_RETURNS,
  MIN_SAMPLE,
  Z_95,
  mean,
  parseReturns,
  sampleStandardDeviation,
  sharpe,
  sharpeStandardError,
  validateSharpeInput,
} from './sharpe';
import type { SharpeInput, SharpeOk } from './sharpe';

// Expected values are worked by hand from
//   m  = sum(r) / n
//   s  = sqrt(sum((r - m)^2) / (n - 1))
//   SR = (m - rf) / s,  annualised = SR x sqrt(periods),  t = SR x sqrt(n)
//   SE = sqrt((1 + SR^2 / 2) / n)          Lo (2002), eq. 9
function ok(input: SharpeInput): SharpeOk {
  const result = sharpe(input);
  if (!result.ok) throw new Error(`expected ok, got issues: ${result.issues.join(', ')}`);
  return result;
}

const pct = (values: number[]) => values.map((v) => v / 100);

// The example the calculator opens with: twelve monthly returns, in percent.
const TWELVE = [3.2, -1.5, 4.1, 0.8, -2.7, 5.0, 1.9, -0.6, 2.4, -3.1, 3.6, 1.1];
// Worked example 2: five weekly returns, in percent.
const FIVE = [2, -1, 3, 0, 1];

describe('mean and sampleStandardDeviation', () => {
  it('mean', () => {
    expect(mean([2, -1, 3, 0, 1])).toBeCloseTo(1, 12);
    expect(mean([5])).toBe(5);
    expect(mean([])).toBeNaN();
    expect(mean([1, Number.NaN])).toBeNaN();
  });

  it('divides by n - 1, not n', () => {
    // deviations from 1: 1, -2, 2, -1, 0; squares sum to 10; 10 / 4 = 2.5
    expect(sampleStandardDeviation([2, -1, 3, 0, 1])).toBeCloseTo(Math.sqrt(2.5), 12);
    // the textbook set 2,4,4,4,5,5,7,9: squares sum to 32; population sd is 2, sample sd is sqrt(32/7)
    expect(sampleStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(sampleStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).not.toBeCloseTo(2, 6);
  });

  it('two values: half the distance times sqrt 2', () => {
    // mean 2, squares 1 + 1 = 2, / 1
    expect(sampleStandardDeviation([1, 3])).toBeCloseTo(Math.SQRT2, 12);
  });

  it('needs two values', () => {
    expect(sampleStandardDeviation([1])).toBeNaN();
    expect(sampleStandardDeviation([])).toBeNaN();
  });
});

describe('sharpeStandardError', () => {
  it('reproduces Table 1 of Lo (2002)', () => {
    // SR, T, the published value to three decimals
    const table: Array<[number, number, number]> = [
      [0.5, 12, 0.306],
      [1.0, 12, 0.354],
      [1.5, 60, 0.188],
      [3.0, 60, 0.303],
      [2.0, 24, 0.354],
      [0.5, 500, 0.047],
      [3.0, 500, 0.105],
    ];
    for (const [sr, t, published] of table) expect(sharpeStandardError(sr, t)).toBeCloseTo(published, 3);
  });

  it('is 1 / sqrt(n) for a Sharpe ratio of zero and is symmetric in the sign', () => {
    expect(sharpeStandardError(0, 25)).toBeCloseTo(0.2, 12);
    expect(sharpeStandardError(-1.5, 60)).toBe(sharpeStandardError(1.5, 60));
  });

  it('returns NaN without a sample', () => {
    expect(sharpeStandardError(1, 0)).toBeNaN();
    expect(sharpeStandardError(Number.NaN, 10)).toBeNaN();
  });
});

describe('sharpe', () => {
  it('the opening example: twelve monthly returns, risk-free rate 0', () => {
    const r = ok({ returns: pct(TWELVE), riskFreeRate: 0, periodsPerYear: 12 });
    expect(r.count).toBe(12);
    // the returns sum to 14.2%
    expect(r.mean).toBeCloseTo(0.142 / 12, 12); // 1.1833%
    // squared distances from 1.1833 sum to 78.936667 (in percent squared); / 11, square root
    expect(r.standardDeviation).toBeCloseTo(0.02678817, 8); // 2.6788%
    expect(r.sharpe).toBeCloseTo(0.44173728, 7);
    expect(r.annualFactor).toBeCloseTo(Math.sqrt(12), 12);
    expect(r.annualizedSharpe).toBeCloseTo(1.53022281, 7);
    // one year of monthly data: n equals the periods per year, so t equals the annualised figure
    expect(r.tStatistic).toBeCloseTo(1.53022281, 7);
    // sqrt((1 + 0.4417^2 / 2) / 12)
    expect(r.standardError).toBeCloseTo(0.30242987, 7);
    expect(r.annualizedStandardError).toBeCloseTo(1.0476478, 6);
    expect(r.annualizedInterval.low).toBeCloseTo(-0.52316687, 6);
    expect(r.annualizedInterval.high).toBeCloseTo(3.5836125, 6);
    expect(r.smallSample).toBe(true);
    expect(r.distinctFromZero).toBe(false);
  });

  it('worked example 2: five weekly returns with a risk-free rate of 0.5% a week', () => {
    const r = ok({ returns: pct(FIVE), riskFreeRate: 0.005, periodsPerYear: 52 });
    expect(r.mean).toBeCloseTo(0.01, 12);
    expect(r.excessMean).toBeCloseTo(0.005, 12);
    expect(r.standardDeviation).toBeCloseTo(Math.sqrt(2.5) / 100, 12); // 1.5811%
    expect(r.sharpe).toBeCloseTo(0.5 / Math.sqrt(2.5), 12); // 0.3162
    expect(r.annualizedSharpe).toBeCloseTo(2.28035085, 7); // x sqrt(52)
    expect(r.tStatistic).toBeCloseTo(Math.SQRT1_2, 12); // 0.3162 x sqrt(5) = 0.7071
    // sqrt((1 + 0.1 / 2) / 5) = sqrt(0.21)
    expect(r.standardError).toBeCloseTo(Math.sqrt(0.21), 12);
    expect(r.annualizedInterval.low).toBeCloseTo(-4.19655211, 6);
    expect(r.annualizedInterval.high).toBeCloseTo(8.75725381, 6);
    expect(r.smallSample).toBe(true);
    expect(r.distinctFromZero).toBe(false);
  });

  it('the interval is the estimate plus and minus 1.96 standard errors, per period and annualised', () => {
    const r = ok({ returns: pct(TWELVE), riskFreeRate: 0.001, periodsPerYear: 365 });
    expect(Z_95).toBe(1.96);
    expect(r.interval.low).toBeCloseTo(r.sharpe - 1.96 * r.standardError, 12);
    expect(r.interval.high).toBeCloseTo(r.sharpe + 1.96 * r.standardError, 12);
    expect(r.annualizedInterval.low).toBeCloseTo(r.interval.low * Math.sqrt(365), 12);
    expect(r.annualizedInterval.high).toBeCloseTo(r.interval.high * Math.sqrt(365), 12);
    expect(r.annualizedStandardError).toBeCloseTo(r.standardError * Math.sqrt(365), 12);
  });

  it('the risk-free rate moves the mean, not the deviation', () => {
    const zero = ok({ returns: pct(TWELVE), riskFreeRate: 0, periodsPerYear: 12 });
    const some = ok({ returns: pct(TWELVE), riskFreeRate: 0.004, periodsPerYear: 12 });
    expect(some.standardDeviation).toBe(zero.standardDeviation);
    expect(some.excessMean).toBeCloseTo(zero.mean - 0.004, 12);
    expect(some.sharpe).toBeLessThan(zero.sharpe);
  });

  it('a losing record has a negative Sharpe ratio and a negative t', () => {
    const r = ok({ returns: pct(TWELVE.map((v) => -v)), riskFreeRate: 0, periodsPerYear: 12 });
    expect(r.sharpe).toBeCloseTo(-0.44173728, 7);
    expect(r.annualizedSharpe).toBeCloseTo(-1.53022281, 7);
    expect(r.tStatistic).toBeLessThan(0);
    expect(r.annualizedInterval.low).toBeCloseTo(-3.5836125, 6);
    expect(r.annualizedInterval.high).toBeCloseTo(0.52316687, 6);
  });

  it('the scale of the returns cancels out', () => {
    const a = ok({ returns: pct(TWELVE), riskFreeRate: 0, periodsPerYear: 12 });
    const b = ok({ returns: pct(TWELVE.map((v) => v * 10)), riskFreeRate: 0, periodsPerYear: 12 });
    expect(b.sharpe).toBeCloseTo(a.sharpe, 12);
  });

  it('two returns are enough to compute, and are flagged as a small sample', () => {
    // mean 2%, deviation sqrt(2)%, SR = 2 / sqrt(2) = sqrt(2)
    const r = ok({ returns: [0.01, 0.03], riskFreeRate: 0, periodsPerYear: 1 });
    expect(r.sharpe).toBeCloseTo(Math.SQRT2, 12);
    expect(r.annualizedSharpe).toBeCloseTo(Math.SQRT2, 12);
    expect(r.smallSample).toBe(true);
  });

  it('the small-sample flag clears at MIN_SAMPLE returns', () => {
    const series = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 0.02 : -0.01));
    expect(MIN_SAMPLE).toBe(30);
    expect(ok({ returns: series(29), riskFreeRate: 0, periodsPerYear: 365 }).smallSample).toBe(true);
    expect(ok({ returns: series(30), riskFreeRate: 0, periodsPerYear: 365 }).smallSample).toBe(false);
  });

  it('a long, steady record is told apart from zero', () => {
    // 400 returns alternating +2% and -1%: mean 0.5%, sd about 1.5%, SR about 0.33, SE about 0.05
    const returns = Array.from({ length: 400 }, (_, i) => (i % 2 === 0 ? 0.02 : -0.01));
    const r = ok({ returns, riskFreeRate: 0, periodsPerYear: 365 });
    expect(r.mean).toBeCloseTo(0.005, 12);
    expect(r.sharpe).toBeCloseTo(0.005 / Math.sqrt((400 * 0.015 ** 2) / 399), 9);
    expect(r.interval.low).toBeGreaterThan(0);
    expect(r.distinctFromZero).toBe(true);
    expect(r.smallSample).toBe(false);
  });
});

describe('sharpe, invalid input', () => {
  const base: SharpeInput = { returns: pct(TWELVE), riskFreeRate: 0, periodsPerYear: 12 };
  const issues = (patch: Partial<SharpeInput>) => validateSharpeInput({ ...base, ...patch });

  it('accepts the base input', () => {
    expect(issues({})).toEqual([]);
  });

  it('needs two returns', () => {
    expect(issues({ returns: [] })).toEqual(['tooFew']);
    expect(issues({ returns: [0.01] })).toEqual(['tooFew']);
  });

  it('refuses more than MAX_RETURNS', () => {
    const many = Array.from({ length: MAX_RETURNS + 1 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01));
    expect(issues({ returns: many })).toEqual(['tooMany']);
    expect(issues({ returns: many.slice(1) })).toEqual([]);
  });

  it('refuses values that are not finite numbers', () => {
    expect(issues({ returns: [0.01, Number.NaN] })).toEqual(['returns']);
    expect(issues({ returns: [0.01, Number.POSITIVE_INFINITY] })).toEqual(['returns']);
    expect(issues({ returns: 'abc' as never })).toEqual(['returns']);
  });

  it('checks the risk-free rate and the periods per year', () => {
    expect(issues({ riskFreeRate: Number.NaN })).toEqual(['riskFreeRate']);
    expect(issues({ riskFreeRate: 1 })).toEqual(['riskFreeRate']);
    expect(issues({ periodsPerYear: 0 })).toEqual(['periodsPerYear']);
    expect(issues({ periodsPerYear: -12 })).toEqual(['periodsPerYear']);
    expect(issues({ periodsPerYear: Number.POSITIVE_INFINITY })).toEqual(['periodsPerYear']);
  });

  it('a deviation of zero is reported as flat, not as an infinite ratio', () => {
    expect(sharpe({ ...base, returns: [0.01, 0.01, 0.01] })).toEqual({ ok: false, issues: ['flat'] });
    expect(sharpe({ ...base, returns: [0, 0] })).toEqual({ ok: false, issues: ['flat'] });
  });

  it('rounding noise is not mistaken for a deviation', () => {
    // 0.1 + 0.2 is 0.30000000000000004: the three values differ in the last binary digit only
    expect(sharpe({ ...base, returns: [0.1 + 0.2, 0.3, 0.3] })).toEqual({ ok: false, issues: ['flat'] });
  });

  it('never returns NaN or Infinity in an ok result', () => {
    for (const returns of [pct(TWELVE), [0.01, 0.03], [-0.99, 5, 0.0001], [1e-9, 2e-9]]) {
      const r = ok({ returns, riskFreeRate: 0, periodsPerYear: 365 });
      const numbers = [
        ...Object.values(r).filter((v): v is number => typeof v === 'number'),
        r.interval.low,
        r.interval.high,
        r.annualizedInterval.low,
        r.annualizedInterval.high,
      ];
      expect(numbers.every(Number.isFinite)).toBe(true);
    }
  });
});

describe('parseReturns', () => {
  it('reads commas, spaces and line breaks', () => {
    expect(parseReturns('1.5, -2\n0.4').values).toEqual([0.015, -0.02, 0.004]);
    expect(parseReturns('1.5,-2,0.4').rejected).toEqual([]);
    expect(parseReturns('1\t2;3\r\n4').values).toEqual([0.01, 0.02, 0.03, 0.04]);
  });

  it('accepts a percent sign, a plus sign and a real minus sign', () => {
    const parsed = parseReturns('+1.5% −2% -0.25% .5 3.');
    expect(parsed.rejected).toEqual([]);
    expect(parsed.values[0]).toBeCloseTo(0.015, 15);
    expect(parsed.values[1]).toBeCloseTo(-0.02, 15);
    expect(parsed.values[2]).toBeCloseTo(-0.0025, 15);
    expect(parsed.values[3]).toBeCloseTo(0.005, 15);
    expect(parsed.values[4]).toBeCloseTo(0.03, 15);
  });

  it('accepts the full-width separators a Chinese keyboard types', () => {
    expect(parseReturns('1，2、3；4').values).toEqual([0.01, 0.02, 0.03, 0.04]);
  });

  it('ignores extra separators and surrounding space', () => {
    expect(parseReturns('  1,, 2 ,\n\n3,  ').values).toEqual([0.01, 0.02, 0.03]);
    expect(parseReturns('')).toEqual({ values: [], rejected: [] });
    expect(parseReturns('   \n ')).toEqual({ values: [], rejected: [] });
  });

  it('rejects what is not a plain decimal number and keeps the rest', () => {
    const parsed = parseReturns('1.5, abc, 2e3, 1.2.3, --4, 0x10, Infinity, NaN, 5%%, 7');
    expect(parsed.values).toEqual([0.015, 0.07]);
    expect(parsed.rejected).toEqual(['abc', '2e3', '1.2.3', '--4', '0x10', 'Infinity', 'NaN', '5%%']);
  });

  it('keeps the order and repeats', () => {
    expect(parseReturns('3 1 3 2').values).toEqual([0.03, 0.01, 0.03, 0.02]);
  });
});
