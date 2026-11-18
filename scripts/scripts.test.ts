import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { BYBIT_TARGET, BYBIT_TESTNET_TARGET, GATE_TW, RESTRICTED_COUNTRIES } from '../site.config.mjs';
import { buildVercelConfig, renderVercelConfig } from './gen-vercel.mjs';
import { convertArticle, generate } from './gen-zh-hans.mjs';

describe('vercel.json', () => {
  it('is in sync with site.config.mjs (run `npm run gen:vercel` if this fails)', () => {
    const file = fileURLToPath(new URL('../vercel.json', import.meta.url));
    expect(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).toBe(renderVercelConfig());
  });

  const redirects = buildVercelConfig().redirects;
  const forSource = (source: string) => redirects.filter((r) => r.source === source);

  it.each(['/go/bybit/', '/go/bybit', '/go/bybit-testnet/', '/go/bybit-testnet'])('gates %s', (source) => {
    const rules = forSource(source);
    const gated = rules.filter((r) => r.has);
    const open = rules.filter((r) => r.missing);

    const countries = gated.map((r) => r.has![0].value).sort();
    const expected = [...RESTRICTED_COUNTRIES, ...(GATE_TW ? ['TW'] : [])].sort();
    expect(countries).toEqual(expected);
    for (const r of gated) {
      expect(r.destination).toBe('/not-available/');
      expect(r.permanent).toBe(false);
      expect(r.has![0]).toMatchObject({ type: 'header', key: 'x-vercel-ip-country' });
    }

    // Exactly one rule for everybody else, and it excludes every gated country.
    expect(open).toHaveLength(1);
    expect(open[0].missing!.map((m) => m.value).sort()).toEqual(expected);
    expect(open[0].permanent).toBe(false);
    expect(open[0].destination).toBe(source.includes('testnet') ? BYBIT_TESTNET_TARGET : BYBIT_TARGET);
  });

  it('gates Taiwan while GATE_TW is on', () => {
    const tw = redirects.filter((r) => r.has?.[0].value === 'TW');
    expect(tw.length > 0).toBe(GATE_TW);
  });
});

describe('gen-zh-hans', () => {
  const article = [
    '---',
    'title: "爆倉價怎麼算"',
    'slug: "liquidation-price"',
    'description: "用槓桿和維持保證金率算出爆倉價。"',
    'date: "2026-11-18"',
    'lastmod: "2026-11-18"',
    'lang: "zh-Hant"',
    'category: "risk"',
    'tags: ["爆倉", "槓桿"]',
    'keywords:',
    '  - "資金費率"',
    'tldr: "20 倍槓桿只剩不到 5% 的空間。"',
    '---',
    '',
    '永續合約的保證金不夠時會被強制平倉。看[爆倉價計算機](/zh-hant/tools/liquidation-price-calculator/)。',
    '',
  ].join('\n');

  it('converts the body and the text fields, and sets lang', () => {
    const out = convertArticle(article);
    expect(out).toContain('title: "爆仓价怎么算"');
    expect(out).toContain('description: "用杠杆和维持保证金率算出爆仓价。"');
    expect(out).toContain('tags: ["爆仓", "杠杆"]');
    expect(out).toContain('  - "资金费率"');
    expect(out).toContain('tldr: "20 倍杠杆只剩不到 5% 的空间。"');
    expect(out).toContain('lang: "zh-Hans"');
    expect(out).not.toContain('zh-Hant');
    expect(out).toContain('永续合约的保证金不够时会被强制平仓。');
    expect(out).toContain('[爆仓价计算器](/zh-hans/tools/liquidation-price-calculator/)');
  });

  it('leaves slug, dates and category untouched', () => {
    const out = convertArticle(article);
    expect(out).toContain('slug: "liquidation-price"');
    expect(out).toContain('date: "2026-11-18"');
    expect(out).toContain('category: "risk"');
  });

  it('handles Windows line endings', () => {
    expect(convertArticle(article.replace(/\n/g, '\r\n'))).toBe(convertArticle(article));
  });

  it('rejects a file without frontmatter', () => {
    expect(() => convertArticle('沒有 frontmatter')).toThrow();
  });

  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('does nothing, and does not fail, when there are no articles', () => {
    dir = mkdtempSync(join(tmpdir(), 'perpmath-'));
    expect(generate(dir)).toEqual({ written: [], unchanged: [], removed: [] });
    mkdirSync(join(dir, 'zh-hant'));
    expect(generate(dir)).toEqual({ written: [], unchanged: [], removed: [] });
    expect(existsSync(join(dir, 'zh-hans'))).toBe(false);
  });

  it('is idempotent and removes generated files whose source is gone', () => {
    dir = mkdtempSync(join(tmpdir(), 'perpmath-'));
    mkdirSync(join(dir, 'zh-hant'));
    writeFileSync(join(dir, 'zh-hant', 'liquidation-price.md'), article);

    expect(generate(dir).written).toEqual(['liquidation-price.md']);
    const first = readFileSync(join(dir, 'zh-hans', 'liquidation-price.md'), 'utf8');
    expect(generate(dir)).toEqual({ written: [], unchanged: ['liquidation-price.md'], removed: [] });
    expect(readFileSync(join(dir, 'zh-hans', 'liquidation-price.md'), 'utf8')).toBe(first);

    // A hand-written file in zh-hans is never deleted; a generated orphan is.
    writeFileSync(join(dir, 'zh-hans', 'by-hand.md'), '---\ntitle: "x"\n---\n');
    rmSync(join(dir, 'zh-hant', 'liquidation-price.md'));
    expect(generate(dir).removed).toEqual(['liquidation-price.md']);
    expect(readdirSync(join(dir, 'zh-hans'))).toEqual(['by-hand.md']);
  });
});
