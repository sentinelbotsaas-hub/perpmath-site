// Checks the built site in dist/. Run after `npm run build`:
//
//   npm run check:dist
//
// For every HTML page it verifies:
// - <html lang> matches the URL prefix (en, zh-Hant, zh-Hans);
// - the canonical is the page's own absolute URL and ends with a slash;
// - hreflang alternates are reciprocal (every page a page points at exists
//   and points back) and include x-default;
// - every internal link ends with a slash (or is a file) and its target exists;
// - zh-hant pages contain no Simplified characters and zh-hans pages contain
//   no Traditional characters (language names in the switcher are allowed);
// - every indexable page is in the sitemap, and no noindex page is.
// Exits 1 when anything fails. It reads files only; no server, no network.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const SITE = 'https://perpmath.com';
const LANG = { en: 'en', 'zh-hant': 'zh-Hant', 'zh-hans': 'zh-Hans' };
// Pages that exist once, outside the three-locale structure.
const SINGLE = [/^\/404\.html$/, /^\/go\//];

if (!existsSync(DIST)) {
  console.error('check-dist: dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const urlOf = (file) => {
  const rel = '/' + relative(DIST, file).split(sep).join('/');
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
};
const localeOf = (url) => (url.startsWith('/zh-hant/') ? 'zh-hant' : url.startsWith('/zh-hans/') ? 'zh-hans' : 'en');
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Visible text plus the attributes people read or hear. Elements marked with a foreign lang are dropped. */
function textOf(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    // language switcher entries and other inline foreign-language bits
    .replace(/<(a|span)\b[^>]*\slang="[^"]*"[^>]*>[\s\S]*?<\/\1>/g, ' ');
  const attrs = [...body.matchAll(/\s(?:content|aria-label|title|alt|placeholder)="([^"]*)"/g)].map((m) => m[1]);
  // data-* JSON blobs carry UI strings for the browser scripts
  const data = [...body.matchAll(/\sdata-[a-z-]+="([^"]*)"/g)].map((m) => m[1]);
  return decode([body.replace(/<[^>]+>/g, ' '), ...attrs, ...data].join(' '));
}

/** Report the first few places where a converter would change the text. */
// 台/占/布 are everyday Traditional in Taiwan; OpenCC's 臺/佔/佈 are variants,
// not corrections, so both spellings count as the same character here.
const same = (s) => s.replace(/臺/g, '台').replace(/佔/g, '占').replace(/佈/g, '布');

function differences(text, convert) {
  const out = [];
  for (const chunk of text.split(/[\s，。、；：！？（）「」]+/)) {
    if (!chunk || /^[\x00-\x7F]*$/.test(chunk)) continue;
    const converted = convert(chunk);
    if (same(converted) !== same(chunk)) out.push(`${chunk} -> ${converted}`);
  }
  return [...new Set(out)].slice(0, 5);
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const allUrls = new Set(files.map(urlOf));
const pages = new Map();
const problems = [];
const fail = (url, message) => problems.push(`${url}  ${message}`);

for (const file of htmlFiles) {
  const url = urlOf(file);
  const html = readFileSync(file, 'utf8');
  const single = SINGLE.some((re) => re.test(url));
  const locale = localeOf(url);
  const lang = (html.match(/<html[^>]*\slang="([^"]*)"/) || [])[1];
  const canonical = attr((html.match(/<link[^>]*rel="canonical"[^>]*>/) || [''])[0], 'href');
  const robots = attr((html.match(/<meta[^>]*name="robots"[^>]*>/) || [''])[0], 'content') || '';
  const alternates = [...html.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="[^"]*"[^>]*>/g)].map((m) => ({
    hreflang: attr(m[0], 'hreflang'),
    href: attr(m[0], 'href'),
  }));
  const links = [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => decode(m[1]));
  pages.set(url, { url, html, single, locale, lang, canonical, robots, alternates, links });

  if (!/<title>[^<]+<\/title>/.test(html)) fail(url, 'no <title>');
  if (!/<meta[^>]*name="description"[^>]*content="[^"]+"/.test(html)) fail(url, 'no meta description');
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail(url, 'page must have exactly one <h1>');
  if (/<\/html>\s*\S/.test(html)) fail(url, 'markup after </html>');

  if (lang !== LANG[locale]) fail(url, `lang is "${lang}", expected "${LANG[locale]}"`);

  const expectedCanonical = url === '/404.html' ? `${SITE}/404/` : SITE + url;
  if (canonical !== expectedCanonical) fail(url, `canonical is "${canonical}", expected "${expectedCanonical}"`);

  const noindex = /noindex/.test(robots);
  if (single && !noindex) fail(url, 'single-locale utility page must be noindex');
  if (!noindex && !/max-image-preview:large/.test(robots)) fail(url, 'robots meta lacks max-image-preview:large');

  if (!noindex) {
    const byLang = Object.fromEntries(alternates.map((a) => [a.hreflang, a.href]));
    if (byLang[LANG[locale]] !== canonical) fail(url, 'hreflang for its own language does not equal the canonical');
    if (byLang.en && byLang['x-default'] !== byLang.en) fail(url, 'x-default is missing or is not the English page');
    for (const a of alternates) {
      if (!a.href.startsWith(SITE + '/') || !a.href.endsWith('/')) fail(url, `hreflang href is not an absolute slash URL: ${a.href}`);
    }
  } else if (alternates.length) {
    fail(url, 'noindex page should not carry hreflang alternates');
  }

  for (const href of links) {
    if (/^(https?:|mailto:|tel:)/.test(href) || href.startsWith('#')) continue;
    if (!href.startsWith('/')) {
      fail(url, `relative link "${href}" (use localePath())`);
      continue;
    }
    const path = href.replace(/[?#].*$/, '');
    if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) fail(url, `internal link without trailing slash: ${href}`);
    if (!allUrls.has(path)) fail(url, `internal link to a page that does not exist: ${href}`);
  }

  if (!single) {
    const text = textOf(html);
    if (locale === 'zh-hant') {
      for (const d of differences(text, toTraditional)) fail(url, `Simplified characters in zh-hant: ${d}`);
    }
    if (locale === 'zh-hans') {
      for (const d of differences(text, toSimplified)) fail(url, `Traditional characters in zh-hans: ${d}`);
    }
  }
}

// hreflang must be reciprocal.
for (const page of pages.values()) {
  for (const a of page.alternates) {
    if (a.hreflang === 'x-default') continue;
    const target = pages.get(a.href.slice(SITE.length));
    if (!target) {
      fail(page.url, `hreflang ${a.hreflang} points at a page that was not built: ${a.href}`);
      continue;
    }
    if (target.lang !== a.hreflang) fail(page.url, `hreflang ${a.hreflang} points at a page whose lang is ${target.lang}`);
    if (!target.alternates.some((b) => b.href === page.canonical)) {
      fail(page.url, `hreflang ${a.hreflang} target does not link back: ${a.href}`);
    }
  }
}

// Every three-locale page must exist in all three locales (articles excepted).
for (const page of pages.values()) {
  if (page.single || page.locale !== 'en' || page.url.startsWith('/learn/') && page.url !== '/learn/') continue;
  for (const prefix of ['/zh-hant', '/zh-hans']) {
    if (!pages.has(prefix + page.url)) fail(page.url, `missing ${prefix} version`);
  }
}

// Sitemap: indexable pages in, noindex pages out.
const sitemapFiles = files.filter((f) => /sitemap-\d+\.xml$/.test(f));
const inSitemap = new Set(
  sitemapFiles.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])),
);
if (sitemapFiles.length === 0) problems.push('sitemap  no sitemap-N.xml in dist/');
for (const page of pages.values()) {
  const noindex = /noindex/.test(page.robots);
  if (!noindex && !inSitemap.has(page.canonical)) fail(page.url, 'indexable page is not in the sitemap');
  if (noindex && inSitemap.has(page.canonical)) fail(page.url, 'noindex page is in the sitemap');
}
const robotsTxt = existsSync(join(DIST, 'robots.txt')) ? readFileSync(join(DIST, 'robots.txt'), 'utf8') : '';
if (!robotsTxt.includes(`Sitemap: ${SITE}/sitemap-index.xml`)) problems.push('robots.txt  does not point at the sitemap index');

if (problems.length) {
  console.error(`check-dist: ${problems.length} problem(s) in ${pages.size} pages\n`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`check-dist: ${pages.size} pages OK (lang, canonical, reciprocal hreflang, internal links, scripts, sitemap).`);
