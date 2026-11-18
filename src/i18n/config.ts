// Locale list, URL building and hreflang. The single source of truth for
// "which languages exist and where they live". No dependencies, so it is safe
// to import from browser scripts.

export const SITE = 'https://perpmath.com';

export const locales = ['en', 'zh-hant', 'zh-hans'] as const;
export type Locale = (typeof locales)[number];

/** English lives at the root and is also hreflang x-default. */
export const defaultLocale: Locale = 'en';

/** Value for <html lang> and hreflang. */
export const htmlLang: Record<Locale, string> = {
  en: 'en',
  'zh-hant': 'zh-Hant',
  'zh-hans': 'zh-Hans',
};

/** Value for og:locale. */
export const ogLocale: Record<Locale, string> = {
  en: 'en_US',
  'zh-hant': 'zh_TW',
  'zh-hans': 'zh_CN',
};

/** Name of each language, written in that language (for the switcher). */
export const localeName: Record<Locale, string> = {
  en: 'English',
  'zh-hant': '繁體中文',
  'zh-hans': '简体中文',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Normalise a site path: leading slash, trailing slash, no doubled slashes. */
export function normalizePath(path: string): string {
  const [pathname, suffix = ''] = splitSuffix(path);
  let p = `/${pathname}/`.replace(/\/{2,}/g, '/');
  if (/\.[a-z0-9]+\/$/i.test(p)) p = p.slice(0, -1); // files such as /sitemap-index.xml
  return p + suffix;
}

function splitSuffix(path: string): [string, string?] {
  const i = path.search(/[?#]/);
  return i === -1 ? [path] : [path.slice(0, i), path.slice(i)];
}

/**
 * Build the URL path of a page in a locale.
 *   localePath('en', '/tools/')            -> '/tools/'
 *   localePath('zh-hant', '/tools/')       -> '/zh-hant/tools/'
 *   localePath('zh-hans', 'tools/x/#how')  -> '/zh-hans/tools/x/#how'
 * `path` is always the locale-less path. Query strings and hashes are kept.
 */
export function localePath(locale: Locale, path = '/'): string {
  const p = normalizePath(path);
  return locale === defaultLocale ? p : `/${locale}${p}`;
}

/** Split a real URL path into its locale and its locale-less path. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const p = normalizePath(pathname);
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    if (p === `/${locale}/` || p.startsWith(`/${locale}/`)) {
      return { locale, path: p.slice(locale.length + 1) };
    }
  }
  return { locale: defaultLocale, path: p };
}

/** Absolute URL of a page in a locale. */
export function absoluteUrl(locale: Locale, path = '/'): string {
  return SITE + localePath(locale, path);
}

export interface Alternate {
  hreflang: string;
  href: string;
}

/**
 * hreflang alternates for a page: one per locale it exists in, plus x-default
 * (English, when the page exists in English). Every locale version of a page
 * must emit the same list, which is what makes the tags reciprocal.
 */
export function alternates(path: string, available: readonly Locale[] = locales): Alternate[] {
  const list: Alternate[] = locales
    .filter((l) => available.includes(l))
    .map((l) => ({ hreflang: htmlLang[l], href: absoluteUrl(l, path) }));
  if (available.includes(defaultLocale)) {
    list.push({ hreflang: 'x-default', href: absoluteUrl(defaultLocale, path) });
  }
  return list;
}

/** Value of the `[...locale]` route param for a locale. */
export function localeParam(locale: Locale): string | undefined {
  return locale === defaultLocale ? undefined : locale;
}

/** Locale for a `[...locale]` route param value. */
export function localeFromParam(param: string | undefined): Locale {
  return isLocale(param) ? param : defaultLocale;
}

/**
 * getStaticPaths() for a page that exists in all three locales.
 *
 *   export const getStaticPaths = localeStaticPaths;
 *   const { locale } = Astro.props;
 */
export function localeStaticPaths() {
  return locales.map((locale) => ({
    params: { locale: localeParam(locale) },
    props: { locale },
  }));
}
