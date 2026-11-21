import { describe, expect, it } from 'vitest';
import {
  amount,
  formatProbability,
  percent,
  ratioText,
  signed,
  signedPercent,
  simulationText,
  typedNumber,
  typedPercent,
} from './figures';

describe('percent', () => {
  it('prints two decimals with thousands separators', () => {
    expect(percent(0.2239)).toBe('22.39%');
    expect(percent(0.5)).toBe('50.00%');
    expect(percent(12.5)).toBe('1,250.00%');
    expect(percent(0.00971, 3)).toBe('0.971%');
  });
});

describe('typedPercent and typedNumber', () => {
  it('keep what was typed, without trailing zeros', () => {
    expect(typedPercent(0.4)).toBe('40%');
    expect(typedPercent(0.025)).toBe('2.5%');
    expect(typedPercent(0.00055)).toBe('0.055%');
    expect(typedPercent(0.07)).toBe('7%'); // 0.07 x 100 is 7.000000000000001 in binary
    expect(typedNumber(2)).toBe('2');
    expect(typedNumber(1.25)).toBe('1.25');
    expect(typedNumber(68000)).toBe('68,000');
    expect(typedNumber(0.1 + 0.2)).toBe('0.3');
    expect(typedNumber(1.02 * 0.98)).toBe('0.9996');
    expect(typedNumber(66400.5)).toBe('66,400.5');
    expect(typedNumber(0.00001234)).toBe('0.00001234');
  });
});

describe('amount', () => {
  it('prints at most two decimals from 1 upwards', () => {
    expect(amount(1600)).toBe('1,600');
    expect(amount(73.92)).toBe('73.92');
    expect(amount(1673.9200000000001)).toBe('1,673.92');
    expect(amount(77.004)).toBe('77');
    expect(amount(-100.1)).toBe('-100.1');
  });

  it('keeps four significant digits below 1, so a small price is not printed as 0', () => {
    expect(amount(0.205)).toBe('0.205');
    expect(amount(0.000002345678)).toBe('0.000002346');
    expect(amount(0)).toBe('0');
  });
});

describe('formatProbability', () => {
  it('prints two decimals of a percent in the middle of the range', () => {
    expect(formatProbability(0.124651)).toBe('12.47%');
    expect(formatProbability(0.5)).toBe('50.00%');
    expect(formatProbability(0.00005)).toBe('0.01%');
    expect(formatProbability(0.9999)).toBe('99.99%');
  });

  it('does not round a small chance down to nothing, or a large one up to certain', () => {
    expect(formatProbability(0.0000004)).toBe('<0.01%');
    expect(formatProbability(0.000049)).toBe('<0.01%');
    expect(formatProbability(0.99996)).toBe('>99.99%');
    expect(formatProbability(0.999999999)).toBe('>99.99%');
  });

  it('prints the two ends exactly', () => {
    expect(formatProbability(0)).toBe('0%');
    expect(formatProbability(1)).toBe('100%');
  });

  it('gives nothing for a value that is not a probability', () => {
    expect(formatProbability(Number.NaN)).toBe('');
    expect(formatProbability(-0.1)).toBe('');
    expect(formatProbability(1.1)).toBe('');
    expect(formatProbability(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('signed', () => {
  it('always prints the sign, with a real minus', () => {
    expect(signed(0.2)).toBe('+0.20');
    expect(signed(-0.1)).toBe('−0.10');
    expect(signed(1234.5, 1)).toBe('+1,234.5');
  });

  it('prints zero, and anything that rounds to it, without a sign', () => {
    expect(signed(0)).toBe('0.00');
    expect(signed(-0.001)).toBe('0.00');
    expect(signed(0.004)).toBe('0.00');
  });

  it('signedPercent takes a fraction', () => {
    expect(signedPercent(0.0097123)).toBe('+0.971%');
    expect(signedPercent(-0.0046718)).toBe('−0.467%');
    expect(signedPercent(0)).toBe('0.000%');
    expect(signedPercent(0.25, 2)).toBe('+25.00%');
  });
});

describe('simulationText', () => {
  const strings = { sim: '{est} ± {se}', simNone: '0 of {paths} paths', simAll: 'All {paths} paths' };

  it('prints the estimate with its standard error', () => {
    expect(simulationText({ ruined: 1203, paths: 10000, estimate: 0.1203, standardError: 0.003253 }, strings)).toBe('12.03% ± 0.33%');
  });

  it('prints the count when none or all of the paths touched the threshold', () => {
    expect(simulationText({ ruined: 0, paths: 10000, estimate: 0, standardError: 0 }, strings)).toBe('0 of 10,000 paths');
    expect(simulationText({ ruined: 10000, paths: 10000, estimate: 1, standardError: 0 }, strings)).toBe('All 10,000 paths');
  });
});

describe('ratioText', () => {
  it('prints two decimals below 1,000', () => {
    expect(ratioText(2.5)).toBe('2.50');
    expect(ratioText(0.1)).toBe('0.10');
    expect(ratioText(13.705)).toBe('13.71');
    expect(ratioText(999.994)).toBe('999.99');
  });

  it('drops the decimals from 1,000 and stops counting at a million', () => {
    expect(ratioText(1000)).toBe('1,000');
    expect(ratioText(4200.4)).toBe('4,200');
    expect(ratioText(999999.4)).toBe('999,999');
    expect(ratioText(999999.5)).toBe('>999,999');
    expect(ratioText(1e15)).toBe('>999,999');
  });

  it('prints a ratio that went negative after fees with its sign', () => {
    expect(ratioText(-0.5)).toBe('-0.50');
  });
});
