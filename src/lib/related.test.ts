// The map of related lessons: what the block at the foot of a page may show.
import { describe, expect, it } from 'vitest';
import { allResults, backtestPath } from './backtests/load';
import { ENGINE_GUIDES, LISTED_ON_PAGE, MAX_RELATED, RELATED, relatedSlugs } from './related';

describe('related lessons', () => {
  it('shows three at most', () => {
    expect(MAX_RELATED).toBe(3);
  });

  it('keeps every key a page path and every slug a slug, with no slug twice in a list', () => {
    for (const [path, slugs] of Object.entries(RELATED)) {
      expect(path).toMatch(/^\/([a-z0-9-]+\/)+$/);
      for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('has an entry for every published backtest', () => {
    for (const result of allResults) expect(RELATED[backtestPath(result.slug)]?.length).toBeGreaterThan(0);
  });

  it('leaves out what a page lists itself', () => {
    expect(LISTED_ON_PAGE['/bot/']).toBe(ENGINE_GUIDES);
    for (const slug of ENGINE_GUIDES) {
      expect(RELATED['/bot/']).toContain(slug);
      expect(relatedSlugs('/bot/')).not.toContain(slug);
    }
    // a page without such a section gets its list as it is
    expect(relatedSlugs('/backtests/')).toEqual(RELATED['/backtests/']);
    expect(relatedSlugs('/no-such-page/')).toEqual([]);
  });

  it('lists the engine lessons on /bot/', () => {
    for (const slug of [
      'bybit-api-python',
      'bybit-testnet',
      'build-a-trading-bot-python',
      'how-to-backtest-a-trading-strategy',
      'grid-trading-bot',
      'max-drawdown',
      'seven-trading-strategies-none-passed',
    ]) {
      expect(ENGINE_GUIDES).toContain(slug);
    }
  });
});
