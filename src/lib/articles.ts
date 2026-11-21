// Articles grouped by locale and slug. Build-time only.
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { htmlLang, isLocale, locales } from '../i18n/config';
import type { Locale } from '../i18n/config';

export type Article = CollectionEntry<'articles'>;

export interface LocalizedArticle {
  locale: Locale;
  entry: Article;
  /** Locales in which an article with the same slug exists. */
  availableLocales: Locale[];
}

/** Locale of an entry, from its folder: "zh-hant/my-slug" -> "zh-hant". */
function localeOf(entry: Article): Locale {
  const folder = entry.id.split('/')[0];
  if (!isLocale(folder)) throw new Error(`Article ${entry.id}: unknown locale folder "${folder}"`);
  return folder;
}

export async function getArticles(): Promise<LocalizedArticle[]> {
  // Scheduled release: an article dated after the build day is left out of
  // the build entirely (no page, no sitemap entry, no link to it). The day is
  // UTC. PERPMATH_BUILD_DATE overrides it: 2099-12-31 previews everything.
  const buildDay = process.env.PERPMATH_BUILD_DATE ?? new Date().toISOString().slice(0, 10);
  const entries = (await getCollection('articles')).filter((entry) => entry.data.date <= buildDay);
  const bySlug = new Map<string, Set<Locale>>();

  for (const entry of entries) {
    const locale = localeOf(entry);
    const file = entry.id.split('/').slice(1).join('/');
    if (file !== entry.data.slug) {
      throw new Error(`Article ${entry.id}: file name must equal its slug "${entry.data.slug}"`);
    }
    if (entry.data.lang !== htmlLang[locale]) {
      throw new Error(`Article ${entry.id}: lang must be "${htmlLang[locale]}", found "${entry.data.lang}"`);
    }
    if (!bySlug.has(entry.data.slug)) bySlug.set(entry.data.slug, new Set());
    bySlug.get(entry.data.slug)!.add(locale);
  }

  return entries.map((entry) => ({
    locale: localeOf(entry),
    entry,
    availableLocales: locales.filter((l) => bySlug.get(entry.data.slug)!.has(l)),
  }));
}

/** Articles of one locale, newest first. */
export async function getArticlesFor(locale: Locale): Promise<LocalizedArticle[]> {
  const all = await getArticles();
  return all
    .filter((a) => a.locale === locale)
    .sort((a, b) => b.entry.data.date.localeCompare(a.entry.data.date) || a.entry.data.slug.localeCompare(b.entry.data.slug));
}

export function articlePath(slug: string): string {
  return `/learn/${slug}/`;
}
