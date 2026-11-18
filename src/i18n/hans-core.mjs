// Traditional Chinese (Taiwan) to Simplified Chinese (Mainland) conversion.
//
// Plain .mjs on purpose: both the Astro build (through src/i18n/hans.ts) and
// the Node script scripts/gen-zh-hans.mjs import this file, so the UI strings
// and the generated articles are converted by exactly the same code.
//
// Never import this from a browser script: opencc-js carries a dictionary of
// several hundred KB. Conversion happens at build time only.
import * as OpenCC from 'opencc-js';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a converter.
 *
 * Text is split on the override terms (longest first). Override terms are
 * replaced by their mapped value verbatim; everything in between goes through
 * OpenCC "twp" to "cn" (Taiwan standard with phrases, to Mainland standard).
 *
 * @param {Record<string, string>} terms  zh-Hant term -> zh-Hans term
 * @returns {(text: string) => string}
 */
export function createToHans(terms = {}) {
  const convert = OpenCC.Converter({ from: 'twp', to: 'cn' });
  const keys = Object.keys(terms).sort((a, b) => b.length - a.length);
  const splitter = keys.length ? new RegExp(`(${keys.map(escapeRegExp).join('|')})`, 'g') : null;

  return function toHans(text) {
    if (typeof text !== 'string' || text === '') return text;
    if (!splitter) return convert(text);
    return text
      .split(splitter)
      .map((part, i) => (i % 2 === 1 ? terms[part] : part === '' ? '' : convert(part)))
      .join('');
  };
}
