// Generates the Simplified Chinese articles from the Traditional Chinese ones.
//
//   src/content/articles/zh-hant/<slug>.md  ->  src/content/articles/zh-hans/<slug>.md
//
// Runs before `dev` and `build` (see package.json). Safe to run any number of
// times: a file is rewritten only when its content would change, and nothing
// happens when there are no articles at all.
//
// What is converted: the body, and the frontmatter values of title,
// description, tldr, tags and keywords. `lang` becomes "zh-Hans". Everything
// else in the frontmatter (slug, dates, category) is copied as it is. Links
// to /zh-hant/... are pointed at /zh-hans/....
//
// Conversion is the same code the UI strings use (src/i18n/hans-core.mjs):
// OpenCC Taiwan -> Mainland with phrases, plus src/i18n/hans-overrides.json.
//
// zh-hans/ is generated output: do not edit files there. A file in zh-hans/
// whose zh-hant source is gone is deleted, but only if it carries the
// GENERATED marker, so a hand-written file is never removed.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToHans } from '../src/i18n/hans-core.mjs';

const MARKER = '# GENERATED from ../zh-hant/ by scripts/gen-zh-hans.mjs. Do not edit.';
const CONVERTED_KEYS = new Set(['title', 'description', 'tldr', 'tags', 'keywords']);

const overridesFile = fileURLToPath(new URL('../src/i18n/hans-overrides.json', import.meta.url));
const toHans = createToHans(JSON.parse(readFileSync(overridesFile, 'utf8')).terms);

/**
 * Convert one zh-hant Markdown file (as text) to zh-hans.
 * Exported for tests.
 * @param {string} source
 * @returns {string}
 */
export function convertArticle(source) {
  const text = source.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('No frontmatter block (--- ... ---) at the top of the file');
  const [, frontmatter, body] = match;

  let currentKey = '';
  let sawLang = false;
  const lines = frontmatter.split('\n').filter((line) => line !== MARKER);
  const converted = lines.map((line) => {
    const top = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (top) {
      currentKey = top[1];
      if (currentKey === 'lang') {
        sawLang = true;
        return 'lang: "zh-Hans"';
      }
      return CONVERTED_KEYS.has(currentKey) ? `${top[1]}:${toHans(top[2])}` : line;
    }
    // Continuation of the previous key: list items or wrapped text.
    return CONVERTED_KEYS.has(currentKey) ? toHans(line) : line;
  });
  if (!sawLang) converted.push('lang: "zh-Hans"');

  const convertedBody = toHans(body).replace(/(\]\(|href=["'])\/zh-hant\//g, '$1/zh-hans/');
  return `---\n${MARKER}\n${converted.join('\n')}\n---\n${convertedBody}`;
}

/**
 * @param {string} articlesDir  .../src/content/articles
 * @returns {{ written: string[], unchanged: string[], removed: string[] }}
 */
export function generate(articlesDir) {
  const srcDir = join(articlesDir, 'zh-hant');
  const outDir = join(articlesDir, 'zh-hans');
  const result = { written: [], unchanged: [], removed: [] };

  const sources = existsSync(srcDir) ? readdirSync(srcDir).filter((f) => f.endsWith('.md')) : [];

  if (sources.length > 0) mkdirSync(outDir, { recursive: true });
  for (const file of sources) {
    let next;
    try {
      next = convertArticle(readFileSync(join(srcDir, file), 'utf8'));
    } catch (error) {
      throw new Error(`zh-hant/${file}: ${error instanceof Error ? error.message : error}`);
    }
    const target = join(outDir, file);
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (current === next) {
      result.unchanged.push(file);
    } else {
      writeFileSync(target, next);
      result.written.push(file);
    }
  }

  // Remove generated files whose source no longer exists.
  if (existsSync(outDir)) {
    for (const file of readdirSync(outDir).filter((f) => f.endsWith('.md'))) {
      if (sources.includes(file)) continue;
      const target = join(outDir, file);
      if (readFileSync(target, 'utf8').includes(MARKER)) {
        rmSync(target);
        result.removed.push(file);
      }
    }
  }
  return result;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  try {
    const dir = fileURLToPath(new URL('../src/content/articles', import.meta.url));
    const r = generate(dir);
    console.log(
      `gen-zh-hans: ${r.written.length} written, ${r.unchanged.length} unchanged, ${r.removed.length} removed.`,
    );
  } catch (error) {
    console.error(`gen-zh-hans: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
