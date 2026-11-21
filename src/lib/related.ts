// Which lessons a tool, data, daily or backtest page links to.
// Key: locale-less page path. Value: article slugs, most relevant first.
// A slug that has no article in the page's locale is skipped, so one map
// serves every locale. An article that is not released yet (dated after the
// build day) does not exist for this purpose either, so a slug can be listed
// here before its article goes live.
export const RELATED: Record<string, string[]> = {
  '/tools/liquidation-price-calculator/': ['what-is-liquidation', 'what-is-funding-rate', 'grid-trading-bot'],
  '/tools/leverage-calculator/': ['what-is-liquidation', 'grid-trading-bot'],
  '/tools/position-size-calculator/': ['what-is-liquidation'],
  '/tools/drawdown-calculator/': ['max-drawdown', 'what-is-liquidation'],
  '/tools/risk-of-ruin-calculator/': ['max-drawdown', 'how-to-backtest-a-trading-strategy', 'what-is-liquidation'],
  '/tools/risk-reward-calculator/': ['what-is-liquidation'],
  '/tools/kelly-criterion-calculator/': ['max-drawdown', 'how-to-backtest-a-trading-strategy', 'what-is-liquidation'],
  '/data/liquidation/': ['what-is-liquidation'],
  '/data/funding-rate/': ['what-is-funding-rate', 'grid-trading-bot', 'bybit-api-python'],
  '/data/open-interest/': ['what-is-funding-rate'],
  '/data/long-short-ratio/': ['what-is-funding-rate'],
  '/daily/btc/': ['what-is-liquidation', 'what-is-funding-rate'],
  '/daily/eth/': ['what-is-liquidation'],
  '/daily/sol/': ['what-is-liquidation'],
  '/backtests/': ['how-to-backtest-a-trading-strategy', 'max-drawdown', 'ict-trading', 'seven-trading-strategies-none-passed'],
  '/backtests/fvg-btcusdt/': ['fair-value-gap', 'ict-trading', 'how-to-backtest-a-trading-strategy'],
  '/backtests/grid-btcusdt/': ['grid-trading-bot', 'how-to-backtest-a-trading-strategy'],
  '/backtests/liquidity-sweep-btcusdt/': ['liquidity-sweep', 'ict-trading', 'fair-value-gap'],
  '/backtests/ma-cross-btcusdt/': ['how-to-backtest-a-trading-strategy', 'max-drawdown'],
  '/backtests/order-block-btcusdt/': ['order-block', 'ict-trading'],
  '/backtests/break-of-structure-btcusdt/': ['break-of-structure', 'ict-trading'],
  '/backtests/breaker-block-btcusdt/': ['breaker-block', 'order-block', 'ict-trading'],
  // /bot/ lists the engine lessons in a section of its own (ENGINE_GUIDES and
  // LISTED_ON_PAGE below). They are repeated here because the home page reads
  // this map the other way round, to say which pages go with a lesson.
  '/bot/': [
    'bybit-api-python',
    'bybit-testnet',
    'build-a-trading-bot-python',
    'how-to-backtest-a-trading-strategy',
    'grid-trading-bot',
    'max-drawdown',
    'seven-trading-strategies-none-passed',
    'fair-value-gap',
  ],
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

/** A page shows at most this many related lessons: the first ones of its list that exist in its locale. */
export const MAX_RELATED = 3;

/**
 * Lessons a page already lists in a section of its own. The related-lessons
 * block at the foot of that page leaves them out, so no card appears twice.
 */
export const LISTED_ON_PAGE: Record<string, string[]> = {
  '/bot/': ENGINE_GUIDES,
};

/**
 * The slugs the related-lessons block of a page may show, in order. The
 * caller drops the ones that have no article in the page's locale and keeps
 * the first MAX_RELATED.
 */
export function relatedSlugs(path: string): string[] {
  const own = LISTED_ON_PAGE[path] ?? [];
  return (RELATED[path] ?? []).filter((slug) => !own.includes(slug));
}
