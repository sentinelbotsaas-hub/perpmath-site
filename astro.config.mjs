// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Pages that must stay out of the sitemap: the affiliate exits, the notice
// gated visitors see, and the 404 page.
const NOT_IN_SITEMAP = /\/(go|not-available|404)\/|\/daily\/[a-z]+\/\d{4}-\d{2}-\d{2}\//;

export default defineConfig({
  site: 'https://perpmath.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Astro 7 strips whitespace between inline elements the way JSX does by
  // default. `true` keeps the older, safer behaviour: collapse, do not remove.
  compressHTML: true,
  // Code blocks in articles take their colours from CSS variables, so they
  // follow the dark and light themes. The variables (--astro-code-*) are set
  // from the design tokens in src/components/article/ArticleProse.astro.
  markdown: { shikiConfig: { theme: 'css-variables' } },
  integrations: [
    sitemap({
      filter: (page) => !NOT_IN_SITEMAP.test(new URL(page).pathname),
      // Locale routing itself is done by src/i18n/config.ts and the
      // [...locale] route folder; this only tells the sitemap which URL
      // prefixes are which language so it can emit hreflang alternates.
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', 'zh-hant': 'zh-Hant', 'zh-hans': 'zh-Hans' },
      },
      // Add x-default (the English page) next to the per-language alternates,
      // matching the <link rel="alternate"> tags in the page head.
      serialize(item) {
        const english = item.links?.find((link) => link.lang === 'en');
        if (english && !item.links.some((link) => link.lang === 'x-default')) {
          item.links.push({ url: english.url, lang: 'x-default' });
        }
        return item;
      },
    }),
  ],
});
