// Which lessons a tool, data, daily or backtest page links to.
// Key: locale-less page path. Value: article slugs, most relevant first.
// A slug that has no article in the page's locale is skipped, so one map
// serves every locale.
export const RELATED: Record<string, string[]> = {
  '/tools/liquidation-price-calculator/': ['what-is-liquidation', 'what-is-funding-rate'],
  '/tools/leverage-calculator/': ['what-is-liquidation'],
  '/tools/position-size-calculator/': ['what-is-liquidation'],
  '/tools/drawdown-calculator/': ['what-is-liquidation'],
  '/tools/risk-of-ruin-calculator/': ['max-drawdown', 'how-to-backtest-a-trading-strategy', 'what-is-liquidation'],
  '/tools/risk-reward-calculator/': ['what-is-liquidation'],
  '/tools/kelly-criterion-calculator/': ['max-drawdown', 'how-to-backtest-a-trading-strategy', 'what-is-liquidation'],
  '/data/liquidation/': ['what-is-liquidation'],
  '/data/funding-rate/': ['what-is-funding-rate'],
  '/data/open-interest/': ['what-is-funding-rate'],
  '/data/long-short-ratio/': ['what-is-funding-rate'],
  '/daily/btc/': ['what-is-liquidation', 'what-is-funding-rate'],
  '/daily/eth/': ['what-is-liquidation'],
  '/daily/sol/': ['what-is-liquidation'],
  '/backtests/': ['fair-value-gap'],
  '/backtests/fvg-btcusdt/': ['fair-value-gap'],
  '/backtests/liquidity-sweep-btcusdt/': ['fair-value-gap'],
  '/backtests/ma-cross-btcusdt/': ['fair-value-gap'],
  '/bot/': ['fair-value-gap'],
};
