// The list of calculators for a locale, with a link for the ones that exist.
import { localePath } from '../i18n/config';
import type { Locale } from '../i18n/config';
import { toolIndex, toolSlugs } from '../i18n/tool-index';
import type { ToolSlug } from '../i18n/tool-index';
import { pageExists } from './routes';

export interface ToolEntry {
  slug: ToolSlug;
  name: string;
  question: string;
  /** Locale-less path, e.g. /tools/leverage-calculator/ */
  path: string;
  /** Localised href, or null while the page has not been built. */
  href: string | null;
}

export function toolPath(slug: ToolSlug): string {
  return `/tools/${slug}/`;
}

export function getTools(locale: Locale): ToolEntry[] {
  return toolSlugs.map((slug) => {
    const path = toolPath(slug);
    return {
      slug,
      ...toolIndex[locale][slug],
      path,
      href: pageExists(path) ? localePath(locale, path) : null,
    };
  });
}

export function getTool(locale: Locale, slug: ToolSlug): ToolEntry {
  return getTools(locale).find((t) => t.slug === slug) as ToolEntry;
}
