import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error plain .mjs build script, no types
import { isUnreleased, unwrapUnreleased } from './unreleased-links.mjs';

const dir = mkdtempSync(join(tmpdir(), 'unreleased-')) + '/';
mkdirSync(dir + 'en');
mkdirSync(dir + 'zh-hant');
writeFileSync(dir + 'en/later.md', '---\ntitle: "x"\ndate: "2026-12-10"\n---\n');
writeFileSync(dir + 'zh-hant/later.md', '---\ndate: "2026-12-12"\n---\n');

describe('isUnreleased', () => {
  it('is true only before the release day of the linked article', () => {
    expect(isUnreleased('/learn/later/', '2026-12-09', dir)).toBe(true);
    expect(isUnreleased('/learn/later/', '2026-12-10', dir)).toBe(false);
    expect(isUnreleased('/learn/later/#faq', '2026-12-09', dir)).toBe(true);
  });
  it('reads the date of the article in the locale of the link', () => {
    expect(isUnreleased('/zh-hant/learn/later/', '2026-12-11', dir)).toBe(true);
    expect(isUnreleased('/learn/later/', '2026-12-11', dir)).toBe(false);
  });
  it('leaves missing articles and other pages alone, so check:dist still catches them', () => {
    expect(isUnreleased('/learn/no-such-article/', '2026-12-01', dir)).toBe(false);
    expect(isUnreleased('/zh-hans/learn/later/', '2026-12-01', dir)).toBe(false);
    expect(isUnreleased('/tools/', '2026-12-01', dir)).toBe(false);
    expect(isUnreleased('https://example.com/learn/later/', '2026-12-01', dir)).toBe(false);
    expect(isUnreleased(undefined, '2026-12-01', dir)).toBe(false);
  });
});

describe('unwrapUnreleased', () => {
  const html = '<p>See <a href="/learn/later/">the <code>later</code> lesson</a> and <a class="x" href="/tools/">tools</a>.</p>';
  it('keeps the text of a link to an unreleased article and drops the anchor', () => {
    expect(unwrapUnreleased(html, '2026-12-09', dir)).toBe(
      '<p>See the <code>later</code> lesson and <a class="x" href="/tools/">tools</a>.</p>',
    );
  });
  it('changes nothing from the release day on', () => {
    expect(unwrapUnreleased(html, '2026-12-10', dir)).toBe(html);
  });
});
