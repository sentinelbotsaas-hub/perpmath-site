// Content collection: articles under /learn/.
//
// Files live at src/content/articles/<locale>/<slug>.md where <locale> is
// en, zh-hant or zh-hans. Write en and zh-hant by hand. zh-hans is generated
// from zh-hant by scripts/gen-zh-hans.mjs (runs before dev and build); never
// edit or add files in zh-hans/.
//
// Frontmatter (PLAN_06 section 6, checked by the seo-acceptance script):
//   title, slug, description (60 to 170 characters), date and lastmod as
//   quoted "YYYY-MM-DD" strings, lang (en | zh-Hant | zh-Hans), category,
//   tags, keywords, tldr.
// The same slug in two locales means "the same article, translated": the
// pages are linked to each other with hreflang.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a quoted date such as "2026-11-18"');

const articles = defineCollection({
  loader: glob({
    pattern: '{en,zh-hant,zh-hans}/*.md',
    base: './src/content/articles',
    // Keep the locale folder in the id ("zh-hant/my-slug"). The default would
    // use the frontmatter slug, and the same slug exists in several locales.
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, digits and hyphens only'),
    description: z.string().min(1),
    date: isoDate,
    lastmod: isoDate,
    lang: z.enum(['en', 'zh-Hant', 'zh-Hans']),
    category: z.string().min(1),
    tags: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    tldr: z.string().min(1),
  }),
});

export const collections = { articles };
