// Article en/dca-bot: the site's DCA calculator against the Python simulation.
//
// Feeds the two ladders of dca_sim.py (six fills, sizes in USDT, base price 80,000)
// to dca() from src/lib/calc/dca.ts, the function behind /tools/dca-calculator/, and
// checks that the average price and the liquidation price after every fill are the
// ones the Python script wrote to dca_summary.json (there as a percentage of the base
// price). Writes calculator_check.json with the values quoted in the article.
//
// Not part of `npm test` (the site's vitest config only looks in src/ and scripts/).
// Run from the site's root folder:
//   npx vitest run --config research/dca-bot/vitest.research.config.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dca } from '../../src/lib/calc/dca';

const here = dirname(fileURLToPath(import.meta.url));
const summary = JSON.parse(readFileSync(join(here, 'dca_summary.json'), 'utf8'));
const BASE = 80000;
const MMR = summary.costs.maintenance_margin_rate;
const LEVERAGES = [2, 3, 5, 10, 20];
const out: Record<string, unknown> = { article: 'en/dca-bot', base_price: BASE, mmr: MMR, rule_sets: {} };

describe.each(['x2', 'x1'])('ladder %s', (name) => {
  const block = summary.rule_sets[name];
  const sizes: number[] = [block.rules.base_order_usdt, ...block.rules.safety_order_sizes_usdt];
  const exactSizes = name === 'x1' ? sizes.map(() => 10000 / 6) : sizes;
  const fills = exactSizes.map((size, k) => ({ price: BASE * (1 - 0.02 * k), size }));
  const rows: unknown[] = [];

  it.each(LEVERAGES)('average and liquidation price at %ix match the Python script', (leverage) => {
    const result = dca({ fills, sizeUnit: 'amount', futures: { side: 'long', leverage, mmr: MMR, maxLeverage: 150 } });
    if (!result.ok) throw new Error(JSON.stringify(result));
    result.steps.forEach((step, k) => {
      const python = block.ladder.rows[k];
      expect((100 * step.averagePrice) / BASE).toBeCloseTo(python.average_pct_of_base, 3);
      expect((100 * (step.liquidationPrice as number)) / BASE).toBeCloseTo(python.liquidation_pct_of_base[String(leverage)], 3);
    });
    const blocked = block.ladder.first_fill_that_cannot_happen[String(leverage)];
    expect(result.futures!.liquidatedBeforeFill).toBe(blocked);
    expect(result.totalCost).toBeCloseTo(10000, 6);
    rows.push({
      leverage,
      average_price: Math.round(result.averagePrice * 100) / 100,
      liquidation_price: Math.round(result.futures!.liquidationPrice * 100) / 100,
      last_fill_to_liquidation_pct: Math.round(result.futures!.lastToLiquidation * 10000) / 100,
      last_fill_to_average_pct: Math.round(result.lastToAverage * 10000) / 100,
      unrealized_at_last_fill: Math.round(result.unrealizedAtLast * 100) / 100,
      liquidated_before_fill: result.futures!.liquidatedBeforeFill,
    });
    (out.rule_sets as Record<string, unknown>)[name] = { fills, rows };
    writeFileSync(join(here, 'calculator_check.json'), JSON.stringify(out, null, 2) + '\n');
  });
});
