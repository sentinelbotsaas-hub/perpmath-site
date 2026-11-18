import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  alternates,
  htmlLang,
  localeFromParam,
  localeParam,
  localePath,
  localeStaticPaths,
  locales,
  normalizePath,
  splitLocale,
} from './config';

describe('localePath', () => {
  it('keeps English at the root and prefixes the Chinese locales', () => {
    expect(localePath('en', '/')).toBe('/');
    expect(localePath('zh-hant', '/')).toBe('/zh-hant/');
    expect(localePath('zh-hans', '/')).toBe('/zh-hans/');
    expect(localePath('en', '/tools/')).toBe('/tools/');
    expect(localePath('zh-hant', '/tools/')).toBe('/zh-hant/tools/');
  });

  it('always ends with a slash', () => {
    expect(localePath('en', 'tools')).toBe('/tools/');
    expect(localePath('zh-hans', '/tools/liquidation-price-calculator')).toBe(
      '/zh-hans/tools/liquidation-price-calculator/',
    );
    expect(localePath('en')).toBe('/');
  });

  it('keeps query strings and hashes after the slash', () => {
    expect(localePath('zh-hant', '/tools/x/?lev=20')).toBe('/zh-hant/tools/x/?lev=20');
    expect(localePath('en', '/tools/x#how')).toBe('/tools/x/#how');
  });
});

describe('normalizePath', () => {
  it('collapses doubled slashes and leaves file names alone', () => {
    expect(normalizePath('//tools//x')).toBe('/tools/x/');
    expect(normalizePath('/sitemap-index.xml')).toBe('/sitemap-index.xml');
  });
});

describe('splitLocale', () => {
  it('finds the locale of a real URL path', () => {
    expect(splitLocale('/')).toEqual({ locale: 'en', path: '/' });
    expect(splitLocale('/tools/')).toEqual({ locale: 'en', path: '/tools/' });
    expect(splitLocale('/zh-hant/')).toEqual({ locale: 'zh-hant', path: '/' });
    expect(splitLocale('/zh-hans/tools/x/')).toEqual({ locale: 'zh-hans', path: '/tools/x/' });
  });

  it('round-trips with localePath', () => {
    for (const locale of locales) {
      for (const path of ['/', '/tools/', '/learn/some-article/']) {
        expect(splitLocale(localePath(locale, path))).toEqual({ locale, path });
      }
    }
  });
});

describe('alternates', () => {
  it('lists every locale plus x-default pointing at English', () => {
    expect(alternates('/tools/')).toEqual([
      { hreflang: 'en', href: 'https://perpmath.com/tools/' },
      { hreflang: 'zh-Hant', href: 'https://perpmath.com/zh-hant/tools/' },
      { hreflang: 'zh-Hans', href: 'https://perpmath.com/zh-hans/tools/' },
      { hreflang: 'x-default', href: 'https://perpmath.com/tools/' },
    ]);
  });

  it('lists only the locales a page exists in, and no x-default without English', () => {
    expect(alternates('/learn/a/', ['zh-hant', 'zh-hans'])).toEqual([
      { hreflang: 'zh-Hant', href: 'https://perpmath.com/zh-hant/learn/a/' },
      { hreflang: 'zh-Hans', href: 'https://perpmath.com/zh-hans/learn/a/' },
    ]);
  });

  it('is the same list whichever locale asks, so the tags are reciprocal', () => {
    const list = alternates('/about/');
    for (const locale of locales) {
      expect(list.some((a) => a.hreflang === htmlLang[locale] && a.href === absoluteUrl(locale, '/about/'))).toBe(true);
    }
  });
});

describe('route params', () => {
  it('maps locales to the [...locale] param and back', () => {
    expect(localeParam('en')).toBeUndefined();
    expect(localeParam('zh-hant')).toBe('zh-hant');
    expect(localeFromParam(undefined)).toBe('en');
    expect(localeFromParam('zh-hans')).toBe('zh-hans');
    expect(localeFromParam('fr')).toBe('en');
  });

  it('localeStaticPaths yields one path per locale', () => {
    expect(localeStaticPaths()).toEqual([
      { params: { locale: undefined }, props: { locale: 'en' } },
      { params: { locale: 'zh-hant' }, props: { locale: 'zh-hant' } },
      { params: { locale: 'zh-hans' }, props: { locale: 'zh-hans' } },
    ]);
  });
});
