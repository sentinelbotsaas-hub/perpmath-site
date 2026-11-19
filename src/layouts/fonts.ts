// Font files and the @font-face rules Base.astro prints in every page head.
// Build-time only.
//
// The files live in public/fonts/ and are committed:
//   geist-sans-latin-var.woff2   Geist, variable weight 100 to 900, Latin subset
//   geist-mono-latin-var.woff2   Geist Mono, same
//   noto-sans-tc-head.woff2      Noto Sans TC, weight 600 only, heading subset
//   noto-sans-sc-head.woff2      Noto Sans SC, weight 600 only, heading subset
// The two Noto files hold only the characters used in headings, the menu and
// buttons. scripts/subset-cjk.mjs makes them; docs/DESIGN_SYSTEM.md says when
// to run it again.
//
// Each URL carries a short hash of the file, so a regenerated subset is never
// served from an old cache entry.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from '../i18n/config';

const DIR = join(process.cwd(), 'public', 'fonts');

function url(file: string): string | null {
  const path = join(DIR, file);
  if (!existsSync(path)) return null;
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 8);
  return `/fonts/${file}?v=${hash}`;
}

const SANS = url('geist-sans-latin-var.woff2');
const MONO = url('geist-mono-latin-var.woff2');
const CJK_HEAD: Partial<Record<Locale, { family: string; url: string | null }>> = {
  'zh-hant': { family: 'Noto Sans TC Head', url: url('noto-sans-tc-head.woff2') },
  'zh-hans': { family: 'Noto Sans SC Head', url: url('noto-sans-sc-head.woff2') },
};

// What the two Geist subsets contain (printed by the subsetting step).
const U_LATIN =
  'U+0020-007E,U+00A0-00AC,U+00AE-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2013-2014,U+2018-201A,U+201C-201E,U+2020-2022,U+2026,U+2030,U+2032-2033,U+2039-203A,U+2044,U+20AC,U+2122,U+2190-2193,U+2212,U+221E,U+2248,U+2260,U+2264-2265';

// Local fonts scaled to Geist's measurements, used until the webfont arrives,
// so that the swap does not re-wrap a line. Numbers: average advance width of
// English text and the hhea ascent/descent of each font.
const FALLBACKS = [
  '@font-face{font-family:"Geist Fallback";src:local("Arial");size-adjust:105.52%;ascent-override:95.24%;descent-override:27.96%;line-gap-override:0%}',
  '@font-face{font-family:"Geist Mono Fallback Consolas";src:local("Consolas");size-adjust:109.13%;ascent-override:92.09%;descent-override:27.03%;line-gap-override:0%}',
  '@font-face{font-family:"Geist Mono Fallback";src:local("Menlo"),local("Courier New");ascent-override:100.5%;descent-override:29.5%;line-gap-override:0%}',
];

/** The @font-face block for a page in this locale. */
export function fontFaceCss(locale: Locale): string {
  const rules: string[] = [];
  if (SANS) {
    rules.push(
      `@font-face{font-family:"Geist";font-style:normal;font-weight:100 900;font-display:swap;src:url(${SANS}) format("woff2");unicode-range:${U_LATIN}}`,
    );
  }
  if (MONO) {
    rules.push(
      `@font-face{font-family:"Geist Mono";font-style:normal;font-weight:100 900;font-display:swap;src:url(${MONO}) format("woff2");unicode-range:${U_LATIN}}`,
    );
  }
  const head = CJK_HEAD[locale];
  if (head?.url) {
    // One real weight (600). The range makes 500 to 700 all resolve to it
    // without the browser faking a bold.
    rules.push(
      `@font-face{font-family:"${head.family}";font-style:normal;font-weight:500 700;font-display:swap;src:url(${head.url}) format("woff2")}`,
    );
  }
  return [...rules, ...FALLBACKS].join('\n');
}

/** Fonts the first screen needs, for <link rel="preload">. */
export function preloadFonts(locale: Locale): string[] {
  return [SANS, MONO, CJK_HEAD[locale]?.url ?? null].filter((u): u is string => u !== null);
}
