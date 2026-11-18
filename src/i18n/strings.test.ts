// Guards for every strings file in this folder, including ones added later
// (tools.ts, daily.ts, ...): they are picked up automatically.
//
// - en and zh-hant must have exactly the same keys;
// - zh-hant must not contain Simplified characters;
// - zh-hans must not contain Traditional characters or un-converted terms;
// - the same {placeholders} must appear in every language.
import * as OpenCC from 'opencc-js';
import { describe, expect, it } from 'vitest';
import { locales } from './config';
import { hansTerms, toHans } from './hans';

const modules = import.meta.glob(['./*.ts', '!./*.test.ts'], { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

type Bundle = Record<(typeof locales)[number], unknown>;

function isBundle(value: unknown): value is Bundle {
  return (
    !!value &&
    typeof value === 'object' &&
    locales.every((l) => l in (value as object)) &&
    Object.keys(value as object).length === locales.length &&
    typeof (value as Bundle).en === 'object'
  );
}

const bundles: Array<[string, Bundle]> = [];
for (const [file, mod] of Object.entries(modules)) {
  if (file.endsWith('.test.ts')) continue;
  for (const [name, value] of Object.entries(mod)) {
    if (isBundle(value)) bundles.push([`${file} ${name}`, value]);
  }
}

/** Flatten nested strings to [path, text] pairs. */
function flatten(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => flatten(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => flatten(v, path ? `${path}.${k}` : k));
  }
  return [];
}

const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort().join(' ');

// Simplified -> Traditional (Taiwan standard). Text that is already Taiwan
// Traditional comes back unchanged, so any difference is a Simplified character.
const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
// Traditional -> Simplified, characters only. Text that is already Simplified comes back unchanged.
const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

describe('strings files', () => {
  it('finds the strings files', () => {
    expect(bundles.length).toBeGreaterThanOrEqual(5);
  });

  describe.each(bundles)('%s', (_name, bundle) => {
    const en = flatten(bundle.en);
    const hant = flatten(bundle['zh-hant']);
    const hans = flatten(bundle['zh-hans']);

    it('has the same keys in en and zh-hant', () => {
      expect(hant.map(([k]) => k)).toEqual(en.map(([k]) => k));
      expect(hans.map(([k]) => k)).toEqual(en.map(([k]) => k));
    });

    it('uses the same placeholders in every language', () => {
      for (let i = 0; i < en.length; i++) {
        expect(`${hant[i][0]} ${placeholders(hant[i][1])}`).toBe(`${en[i][0]} ${placeholders(en[i][1])}`);
        expect(`${hans[i][0]} ${placeholders(hans[i][1])}`).toBe(`${en[i][0]} ${placeholders(en[i][1])}`);
      }
    });

    it('has no empty strings', () => {
      for (const [key, text] of [...en, ...hant]) expect(`${key}:${text.trim() === '' ? 'EMPTY' : 'ok'}`).toBe(`${key}:ok`);
    });

    it('zh-hant contains no Simplified characters', () => {
      for (const [key, text] of hant) expect(`${key}: ${toTraditional(text)}`).toBe(`${key}: ${text}`);
    });

    it('zh-hans contains no Traditional characters', () => {
      for (const [key, text] of hans) expect(`${key}: ${toSimplified(text)}`).toBe(`${key}: ${text}`);
    });

    it('zh-hans contains none of the un-converted override terms', () => {
      const pinned = Object.entries(hansTerms).filter(([from, to]) => from !== to);
      for (const [key, text] of hans) {
        for (const [from] of pinned) expect(`${key} has ${text.includes(from) ? from : 'none'}`).toBe(`${key} has none`);
      }
    });
  });
});

describe('toHans', () => {
  it('converts the pinned vocabulary', () => {
    expect(toHans('爆倉')).toBe('爆仓');
    expect(toHans('資金費率')).toBe('资金费率');
    expect(toHans('永續合約')).toBe('永续合约');
    expect(toHans('槓桿')).toBe('杠杆');
    expect(toHans('保證金')).toBe('保证金');
    expect(toHans('維持保證金率')).toBe('维持保证金率');
  });

  it('uses Mainland words where they differ from Taiwan words', () => {
    expect(toHans('爆倉價計算機')).toBe('爆仓价计算器');
    expect(toHans('停損')).toBe('止损');
    expect(toHans('帳戶')).toBe('账户');
    expect(toHans('預設')).toBe('默认');
    expect(toHans('連結')).toBe('链接');
    expect(toHans('瀏覽器')).toBe('浏览器');
  });

  it('prefers the longest override term', () => {
    expect(toHans('永續合約的資金費率')).toBe('永续合约的资金费率');
  });

  it('leaves English, numbers and placeholders alone', () => {
    expect(toHans('BTCUSDT 20x {pct} 0.33%')).toBe('BTCUSDT 20x {pct} 0.33%');
    expect(toHans('')).toBe('');
  });

  it('is stable when applied twice', () => {
    const once = toHans('槓桿交易風險很高，你可能在很短的時間內賠光全部保證金。');
    expect(toHans(once)).toBe(once);
  });
});
