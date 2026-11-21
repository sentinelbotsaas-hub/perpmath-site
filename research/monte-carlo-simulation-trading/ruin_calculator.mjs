// Article en/monte-carlo-simulation-trading: what the site's risk-of-ruin
// calculator says for the same four trade lists.
//
// Runs the calculator's own code, src/lib/calc/risk-of-ruin.ts (Node 22.18 or
// newer strips the type annotations when it imports a .ts file). The inputs
// come from monte_carlo.json, written by monte_carlo.py:
//
//   win rate p      share of trades that made money
//   payoff b        mean winning move / mean losing move
//   risk r          mean losing move, as a share of equity
//   threshold       20% and 50% below the starting balance
//   trades          the length of the list
//
// The calculator's model is a coin with two outcomes: +b x r with probability
// p, -r otherwise, every trade independent. The bootstrap in monte_carlo.py
// keeps the real spread of wins and losses and is otherwise the same thing
// (independent draws, fixed sizing rule). The two are put side by side.
//
// Usage, from the site's root folder, after monte_carlo.py:
//   node research/monte-carlo-simulation-trading/ruin_calculator.mjs
// Output: research/monte-carlo-simulation-trading/ruin_calculator.json and a table.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIM_PATHS, SIM_SEED, riskOfRuin, simulateRuin } from '../../src/lib/calc/risk-of-ruin.ts';

const here = dirname(fileURLToPath(import.meta.url));
const summary = JSON.parse(readFileSync(join(here, 'monte_carlo.json'), 'utf8'));
const round = (value, digits) => Number(value.toFixed(digits));

// Worked by hand: one trade, 10% risk, threshold 10%: ruin is one loss, probability 1 - p.
const one = riskOfRuin({ winRate: 0.6, payoff: 1, riskPerTrade: 0.1, threshold: 0.1, trades: 1 });
if (!one.ok || Math.abs(one.probability - 0.4) > 1e-12) throw new Error('self-check failed: one trade');
// Two trades, 10% risk, threshold 19%: only loss-loss gets there (0.9 x 0.9 = 0.81). 0.4 x 0.4 = 0.16.
const two = riskOfRuin({ winRate: 0.6, payoff: 1, riskPerTrade: 0.1, threshold: 0.19, trades: 2 });
if (!two.ok || Math.abs(two.probability - 0.16) > 1e-12) throw new Error('self-check failed: two trades');

const out = { source: 'src/lib/calc/risk-of-ruin.ts', sim_paths: SIM_PATHS, sim_seed: SIM_SEED, lists: {} };
const rows = [];
for (const [name, entry] of Object.entries(summary.lists)) {
  out.lists[name] = {};
  for (const [sizing, sized] of Object.entries(entry.sizing)) {
    const c = sized.calculator_inputs;
    out.lists[name][sizing] = { inputs: c, thresholds: {} };
    for (const threshold of summary.thresholds_below_start) {
      const input = { winRate: c.win_rate, payoff: c.payoff, riskPerTrade: c.risk_per_trade, threshold, trades: c.trades };
      const result = riskOfRuin(input);
      if (!result.ok) throw new Error(`${name} ${sizing}: calculator refused the input: ${result.issues.join(', ')}`);
      const sim = simulateRuin(input, { paths: SIM_PATHS, seed: SIM_SEED });
      const key = `paths_touching_${Math.round(threshold * 100)}pct_below_start_pct`;
      const row = {
        calculator_probability_pct: round(result.probability * 100, 2),
        calculator_simulation_pct: round(sim.estimate * 100, 2),
        eventual: result.eventual.certain ? 'certain' : { upper_pct: round(result.eventual.upper * 100, 2), lower_pct: round(result.eventual.lower * 100, 2) },
        edge_r: round(result.edge, 4),
        log_growth_per_trade: round(result.logGrowth, 8),
        losses_in_a_row_to_threshold: result.lossesToThreshold,
        bootstrap_of_real_trades_pct: sized.methods.bootstrap[key],
        block_bootstrap_of_real_trades_pct: sized.methods.blocks[key],
        shuffle_of_real_trades_pct: sized.methods.shuffle[key],
      };
      out.lists[name][sizing].thresholds[String(threshold)] = row;
      rows.push([name, sizing, threshold, c, row]);
    }
  }
}
writeFileSync(join(here, 'ruin_calculator.json'), JSON.stringify(out, null, 1) + '\n');

const pad = (text, width) => String(text).padStart(width);
console.log(`${'list'.padEnd(26)}${'sizing'.padEnd(11)}${pad('p', 8)}${pad('b', 8)}${pad('r %', 8)}${pad('edge R', 8)}${pad('down', 6)}${pad('calc %', 9)}${pad('boot %', 9)}${pad('block %', 9)}${pad('shuf %', 9)}`);
for (const [name, sizing, threshold, c, row] of rows) {
  console.log(
    `${name.padEnd(26)}${sizing.padEnd(11)}${pad(c.win_rate.toFixed(4), 8)}${pad(c.payoff.toFixed(3), 8)}${pad((c.risk_per_trade * 100).toFixed(3), 8)}${pad(row.edge_r.toFixed(3), 8)}${pad(`${threshold * 100}%`, 6)}${pad(row.calculator_probability_pct.toFixed(2), 9)}${pad(row.bootstrap_of_real_trades_pct.toFixed(2), 9)}${pad(row.block_bootstrap_of_real_trades_pct.toFixed(2), 9)}${pad(row.shuffle_of_real_trades_pct.toFixed(2), 9)}`,
  );
}
console.log('wrote research/monte-carlo-simulation-trading/ruin_calculator.json');
