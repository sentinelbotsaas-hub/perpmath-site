// Which lessons a tool, data, daily or backtest page links to.
// Key: locale-less page path. Value: article slugs, most relevant first.
// A slug that has no article in the page's locale is skipped, so one map
// serves every locale. An article that is not released yet (dated after the
// build day) does not exist for this purpose either, so a slug can be listed
// here before its article goes live.
export const RELATED: Record<string, string[]> = {
  '/tools/liquidation-price-calculator/': ['what-is-liquidation', 'what-is-funding-rate'],
  '/tools/leverage-calculator/': ['what-is-liquidation'],
  '/tools/position-size-calculator/': ['what-is-liquidation'],
  '/tools/drawdown-calculator/': ['what-is-liquidation'],
  '/tools/risk-of-ruin-calculator/': ['max-drawdown', 'how-to-backtest-a-trading-strategy', 'what-is-liquidation'],
  '/tools/risk-reward-calculator/': ['what-is-liquidation'],
  '/tools/kelly-criterion-calculator/': ['max-drawdown', 'how-to-backtest-a-trading-strategy', 'what-is-liquidation'],
  '/tools/dca-calculator/': ['what-is-liquidation'],
  '/tools/crypto-profit-calculator/': ['what-is-funding-rate', 'what-is-liquidation'],
  '/tools/sharpe-ratio-calculator/': ['how-to-backtest-a-trading-strategy', 'max-drawdown'],
  '/data/liquidation/': ['what-is-liquidation'],
  '/data/funding-rate/': ['what-is-funding-rate'],
  '/data/open-interest/': ['what-is-funding-rate'],
  '/data/long-short-ratio/': ['what-is-funding-rate'],
  '/daily/btc/': ['what-is-liquidation', 'what-is-funding-rate'],
  '/daily/eth/': ['what-is-liquidation'],
  '/daily/sol/': ['what-is-liquidation'],
  '/backtests/': ['fair-value-gap'],
  '/backtests/fvg-btcusdt/': ['fair-value-gap'],
  '/backtests/grid-btcusdt/': ['grid-trading-bot', 'how-to-backtest-a-trading-strategy'],
  '/backtests/liquidity-sweep-btcusdt/': ['fair-value-gap'],
  '/backtests/ma-cross-btcusdt/': ['fair-value-gap'],
  '/bot/': ['fair-value-gap'],
};

/**
 * The lessons built on the open-source engine, in reading order: backtesting
 * first, then the grid, then the exchange API and its testnet, then a bot of
 * your own. /bot/ lists the ones that exist in the page's locale under
 * "Guides that use this engine"; the same skipping rule as RELATED applies.
 */
export const ENGINE_GUIDES: string[] = [
  'how-to-backtest-a-trading-strategy',
  'max-drawdown',
  'grid-trading-bot',
  'bybit-api-python',
  'bybit-testnet',
  'build-a-trading-bot-python',
  'seven-trading-strategies-none-passed',
];
