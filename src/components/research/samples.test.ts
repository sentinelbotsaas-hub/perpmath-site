// The display views of a strategy result: the flag of a sample with too few
// trades, the warning that goes with it, and the strings every published
// strategy needs. Expected values are worked by hand from the metric blocks
// written out below.
import { describe, expect, it } from 'vitest';
import { backtests } from '../../i18n/backtests';
import { locales } from '../../i18n/config';
import { formatParam, formatRate } from '../../lib/backtests/format';
import { results } from '../../lib/backtests/load';
import type { BacktestResult } from '../../lib/backtests/types';
import { fmt } from '../../lib/fmt';
import { sampleViews, thinNotices } from './samples';

const t = backtests.en;

// Only the fields the views read.
const block = (metrics: Record<string, unknown>, skipped = 0) => ({
  first_bar: '2026-01-01T00:00:00Z',
  last_bar: '2026-03-01T00:00:00Z',
  metrics: {
    trades: 300,
    wins: 90,
    win_rate_pct: 30,
    avg_r: -0.5,
    t_stat: -3,
    total_return_pct: -20,
    max_drawdown_pct: 25,
    avg_bars_held: 12.4,
    ...metrics,
  },
  signals: { seen: 400, skipped_in_position: skipped },
});
const result = (inSample: ReturnType<typeof block>, outOfSample: ReturnType<typeof block>) =>
  ({ in_sample: inSample, out_of_sample: outOfSample }) as unknown as BacktestResult;

// The out-of-sample block of break_of_structure as the engine wrote it.
const thinBlock = block({ trades: 42, wins: 17, win_rate_pct: 40.4762, avg_r: 0.0649, t_stat: -0.1112, total_return_pct: -3.3512, avg_bars_held: 234.26 }, 461);

describe('sampleViews', () => {
  it('flags a sample with fewer than 100 trades and no other', () => {
    const [inSample, outOfSample] = sampleViews(result(block({}), thinBlock), t);
    expect(inSample.insufficient).toBe(false);
    expect(outOfSample.insufficient).toBe(true);
    expect(outOfSample.verdict).toBe(t.verdict.insufficient);
    expect(sampleViews(result(block({ trades: 100 }), block({ trades: 99 })), t).map((v) => v.insufficient)).toEqual([false, true]);
  });
});

describe('thinNotices', () => {
  it('says nothing when both samples have enough trades', () => {
    expect(thinNotices(result(block({}), block({})), t, t.detail.thin)).toEqual([]);
  });

  it('names the sample and its trade count', () => {
    const notices = thinNotices(result(block({}), thinBlock), t, t.detail.thin);
    expect(notices).toHaveLength(1);
    expect(notices[0].key).toBe('out_of_sample');
    expect(notices[0].title).toBe('Out-of-sample: 42 trades, too few to read');
    expect(notices[0].lines[0]).toContain('100');
  });

  it('never prints a positive average R without the loss beside it', () => {
    const [notice] = thinNotices(result(block({}), thinBlock), t, t.detail.thin);
    const withR = notice.lines.filter((line) => line.includes('+0.06'));
    expect(withR).toHaveLength(1);
    // the same sentence carries the fall in equity and says it is not a result
    expect(withR[0]).toContain('3.35%');
    expect(withR[0]).toContain('42');
    expect(withR[0]).toMatch(/neither figure is a result/);
  });

  it('leaves the average-R sentence out when there is no such conflict', () => {
    const lossBoth = thinNotices(result(block({}), block({ trades: 42, avg_r: -0.2, total_return_pct: -3 })), t, t.detail.thin)[0];
    expect(lossBoth.lines.join(' ')).not.toContain('average R');
    const gainBoth = thinNotices(result(block({}), block({ trades: 42, avg_r: 0.3, total_return_pct: 4 })), t, t.detail.thin)[0];
    expect(gainBoth.lines.join(' ')).not.toContain('average R');
  });

  it('says why there are few trades only when signals were skipped', () => {
    const [skipped] = thinNotices(result(block({}), thinBlock), t, t.detail.thin);
    expect(skipped.lines.at(-1)).toContain('234 bars');
    expect(skipped.lines.at(-1)).toContain('461 signals');
    const [none] = thinNotices(result(block({}), block({ trades: 42 }, 0)), t, t.detail.thin);
    expect(none.lines).toHaveLength(1);
  });

  it.each(locales)('%s: leaves no placeholder', (locale) => {
    const b = backtests[locale];
    for (const notice of thinNotices(result(thinBlock, thinBlock), b, b.detail.thin)) {
      for (const text of [notice.title, ...notice.lines]) expect(text).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('published strategy results', () => {
  it('flag exactly the samples the engine marked insufficient', () => {
    for (const r of results) {
      const views = sampleViews(r, t);
      expect(views.map((v) => v.insufficient)).toEqual([r.in_sample.metrics.insufficient_sample, r.out_of_sample.metrics.insufficient_sample]);
      expect(thinNotices(r, t, t.detail.thin).map((n) => n.key)).toEqual(views.filter((v) => v.insufficient).map((v) => v.key));
    }
  });

  it('do not turn a thin sample with a positive average R into a gain', () => {
    // break_of_structure out-of-sample today: +0.06 R on 42 trades, equity down.
    for (const r of results) {
      for (const key of ['in_sample', 'out_of_sample'] as const) {
        const m = r[key].metrics;
        if (!m.insufficient_sample || m.avg_r === null || m.avg_r <= 0) continue;
        const notice = thinNotices(r, t, t.detail.thin).find((n) => n.key === key);
        expect(notice).toBeDefined();
        if (m.total_return_pct !== null && m.total_return_pct < 0) expect(notice?.lines.join(' ')).toMatch(/equity still fell/);
      }
    }
  });

  describe.each(locales)('%s strings', (locale) => {
    const b = backtests[locale];

    it.each(results.map((r) => [r.slug, r] as const))('%s: has a name, rules and a label for every parameter', (_slug, r) => {
      const strategy = b.strategies[r.strategy as keyof typeof b.strategies];
      expect(strategy).toBeDefined();
      expect(strategy.name).not.toBe('');
      const values = Object.fromEntries(Object.entries(r.config.params).map(([key, value]) => [key, formatParam(value) ?? '']));
      for (const rule of strategy.rules) expect(fmt(rule.text, values)).not.toMatch(/\{\w+\}/);
      for (const key of Object.keys(r.config.params)) expect(b.params[key as keyof typeof b.params]).toBeTruthy();
    });

    it('has the definition and the engine approximation of the three ideas without an agreed definition', () => {
      for (const name of ['order_block', 'break_of_structure', 'breaker_block'] as const) {
        const r = results.find((item) => item.strategy === name);
        if (!r) continue; // the result was removed; its strings may stay
        const definition = b.definitions[name];
        const values = {
          ...Object.fromEntries(Object.entries(r.config.params).map(([key, value]) => [key, formatParam(value) ?? ''])),
          fee: formatRate(r.costs.fee_rate_per_side),
        };
        expect(definition.calls.length).toBeGreaterThanOrEqual(4);
        for (const text of [definition.intro, definition.engine.text, ...definition.calls.map((call) => call.text)]) {
          expect(fmt(text, values)).not.toMatch(/\{\w+\}/);
        }
        // the engine part names the fee the entry pays, taken from the result
        expect(fmt(definition.engine.text, values)).toContain(formatRate(r.costs.fee_rate_per_side));
      }
    });
  });
});
