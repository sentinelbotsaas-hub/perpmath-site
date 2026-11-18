// JSON-LD builders. Pass the result to <Base jsonLd={...}>.
// Every URL they produce is absolute and ends with a slash.
import { SITE, absoluteUrl, htmlLang } from '../i18n/config';
import type { Locale } from '../i18n/config';

export const SITE_NAME = 'perpmath';

type JsonLd = Record<string, unknown>;

const publisher = (): JsonLd => ({
  '@type': 'Organization',
  name: SITE_NAME,
  url: `${SITE}/`,
});

/** Home page. */
export function webSiteLd(locale: Locale, description: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: absoluteUrl(locale, '/'),
    description,
    inLanguage: htmlLang[locale],
    publisher: publisher(),
  };
}

/** A calculator page. Free, runs in the browser. No ratings: we have none. */
export function softwareApplicationLd(
  locale: Locale,
  page: { path: string; name: string; description: string },
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: page.name,
    description: page.description,
    url: absoluteUrl(locale, page.path),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: htmlLang[locale],
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: publisher(),
  };
}

/**
 * Breadcrumb trail. `items` are locale-less paths in order, home first:
 *   breadcrumbLd('en', [{ name: 'Home', path: '/' }, { name: 'Tools', path: '/tools/' }])
 */
export function breadcrumbLd(locale: Locale, items: Array<{ name: string; path: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(locale, item.path),
    })),
  };
}

/** An article under /learn/. */
export function articleLd(
  locale: Locale,
  article: { path: string; title: string; description: string; date: string; lastmod: string; keywords?: string[] },
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.lastmod,
    inLanguage: htmlLang[locale],
    mainEntityOfPage: absoluteUrl(locale, article.path),
    url: absoluteUrl(locale, article.path),
    ...(article.keywords?.length ? { keywords: article.keywords.join(', ') } : {}),
    author: { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl(locale, '/about/') },
    publisher: publisher(),
  };
}

/** Safe to drop into a <script type="application/ld+json">. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
