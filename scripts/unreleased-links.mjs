// Runs after `astro build` (see package.json). In the built HTML, a link to an
// article that is scheduled but not released yet becomes plain text. On the
// first build on or after the target's date the link is simply left in.
//
// This lets articles be written with their links to each other in place,
// whatever order they are released in. A link to an article that does not
// exist at all is left alone, so check:dist still fails on a mistyped slug.
//
// The build day follows src/lib/articles.ts: UTC, PERPMATH_BUILD_DATE overrides.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ARTICLES = fileURLToPath(new URL('../src/content/articles/', import.meta.url));
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const LEARN = /^(?:\/(zh-hant|zh-hans))?\/learn\/([a-z0-9-]+)\/(?:[#?].*)?$/;
const ANCHOR = /<a\s[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;

/** True when href points at an article dated after buildDay. */
export function isUnreleased(href, buildDay, dir = ARTICLES) {
  const match = typeof href === 'string' ? href.match(LEARN) : null;
  if (!match) return false;
  const file = `${dir}${match[1] ?? 'en'}/${match[2]}.md`;
  if (!existsSync(file)) return false;
  const date = readFileSync(file, 'utf8').match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m);
  return date !== null && date[1] > buildDay;
}

/** The html with every link to an unreleased article replaced by its text. */
export function unwrapUnreleased(html, buildDay, dir = ARTICLES) {
  return html.replace(ANCHOR, (anchor, href, inner) => (isUnreleased(href, buildDay, dir) ? inner : anchor));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const buildDay = process.env.PERPMATH_BUILD_DATE ?? new Date().toISOString().slice(0, 10);
  let changed = 0;
  for (const name of readdirSync(DIST, { recursive: true })) {
    if (!String(name).endsWith('.html')) continue;
    const html = readFileSync(DIST + name, 'utf8');
    const out = unwrapUnreleased(html, buildDay);
    if (out !== html) {
      writeFileSync(DIST + name, out);
      changed += 1;
    }
  }
  console.log(`unreleased-links: ${changed} page(s) had links to articles dated after ${buildDay} turned into text.`);
}
