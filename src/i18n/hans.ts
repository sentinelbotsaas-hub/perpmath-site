// toHans(): Traditional Chinese (Taiwan) -> Simplified Chinese (Mainland).
//
// Build-time only. Do not import this file (or anything that imports it,
// which includes every src/i18n/<area>.ts strings file) from a browser
// script: it pulls in the OpenCC dictionary. Pass the strings a script needs
// through data attributes instead (see src/pages/[...locale]/index.astro).
import overrides from './hans-overrides.json';
import { createToHans } from './hans-core.mjs';

export const hansTerms: Record<string, string> = overrides.terms;

/** Convert one string. Non-Chinese text passes through unchanged. */
export const toHans: (text: string) => string = createToHans(hansTerms);

/** Convert every string inside a nested object or array, keeping its shape. */
export function toHansDeep<T>(value: T): T {
  if (typeof value === 'string') return toHans(value) as T;
  if (Array.isArray(value)) return value.map((v) => toHansDeep(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toHansDeep(v)]),
    ) as T;
  }
  return value;
}
