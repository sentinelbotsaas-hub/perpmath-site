// defineStrings(): the pattern every src/i18n/<area>.ts file follows.
//
//   import { defineStrings } from './strings';
//
//   export const tools = defineStrings({
//     en:        { title: 'Leverage calculator', result: 'Use at most {lev}x.' },
//     'zh-hant': { title: '槓桿計算機',           result: '最多用 {lev} 倍。' },
//   });
//
//   // in a page:  const t = tools[locale];  fmt(t.result, { lev: 12 })
//
// You write `en` and `zh-hant` (Taiwan vocabulary, Traditional characters
// only). `zh-hans` is derived here with toHans(); never write it by hand.
// Values are plain strings, arrays or nested objects. Use `{name}`
// placeholders with fmt() from src/lib/fmt.ts instead of functions, so the
// same strings can be handed to browser scripts as JSON.
import type { Locale } from './config';
import { toHansDeep } from './hans';

export function defineStrings<T>(source: { en: T; 'zh-hant': T }): Record<Locale, T> {
  return {
    en: source.en,
    'zh-hant': source['zh-hant'],
    'zh-hans': toHansDeep(source['zh-hant']),
  };
}
