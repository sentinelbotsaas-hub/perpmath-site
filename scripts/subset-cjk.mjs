// Chinese heading fonts: build the two small Noto Sans files the site ships.
//
//   npm run build            first: this reads the built pages in dist/
//   npm run fonts:cjk        rebuild public/fonts/noto-sans-{tc,sc}-head.woff2
//   npm run fonts:check      exit 1 if a heading uses a character the files lack
//
// Why: a full Chinese font is several megabytes. Chinese body text therefore
// uses the reader's system font, and only headings, the menu and buttons use
// Noto Sans, cut down to the characters those places actually contain and to
// one weight (600). The two files are committed, so a normal build downloads
// nothing and needs no Python.
//
// When to run it again: whenever Chinese text in a heading (h1 to h4), the
// header menu, a button, an accordion summary or a footer column title
// changes: a new article, a new page, a reworded button. `npm run build` ends
// with a check that prints the missing characters (it never fails the
// build). A missing character is not an error on the page: the browser draws
// that one character in the system font, which looks slightly different from
// its neighbours. Run this script and commit the two .woff2 files and
// src/layouts/cjk-head-chars.json.
//
// What it needs (only for rebuilding, not for the check):
// - Python 3 with fonttools and brotli:  pip install fonttools brotli
//   (set PYTHON=/path/to/python if it is not on PATH as "python" or "python3")
// - the two source fonts, Noto Sans TC and Noto Sans SC (variable, OFL).
//   They are downloaded once from the Google Fonts repository into
//   .tmp/fonts/ (git-ignored). To use files you already have:
//     node scripts/subset-cjk.mjs --tc path/to/NotoSansTC.ttf --sc path/to/NotoSansSC.ttf
//
// Reads files and, when rebuilding, downloads the two fonts. Nothing else
// touches the network.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'public', 'fonts');
const CACHE = join(ROOT, '.tmp', 'fonts');
const MANIFEST = join(ROOT, 'src', 'layouts', 'cjk-head-chars.json');
const WEIGHT = 600;

const TARGETS = [
  {
    locale: 'zh-hant',
    file: 'noto-sans-tc-head.woff2',
    source: 'NotoSansTC[wght].ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf',
    flag: '--tc',
  },
  {
    locale: 'zh-hans',
    file: 'noto-sans-sc-head.woff2',
    source: 'NotoSansSC[wght].ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf',
    flag: '--sc',
  },
];
const LICENCE = {
  file: 'NotoSans-OFL.txt',
  url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/OFL.txt',
};

// Punctuation that can turn up in any heading. Always included.
const ALWAYS = '，。、；：！？「」『』（）〈〉《》【】—…‧・％＋－／～　';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const CHECK = flag('--check');
const WARN_ONLY = flag('--warn');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// The places that are set in the heading font (var(--font-display) in the
// stylesheets). Keep this list in step with src/styles/*.css.
const PLACES = [
  /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/g,
  /<(button)\b[^>]*>([\s\S]*?)<\/\1>/g,
  /<(summary)\b[^>]*>([\s\S]*?)<\/\1>/g,
  /<(header)\b[^>]*class="[^"]*\bsite-header\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g,
  /<(a)\b[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g,
  /<(p)\b[^>]*class="[^"]*\bfooter-head\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g,
  // Lists from before the redesign: tool names and article titles.
  /<(a|span)\b[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g,
  /<(li)>\s*<a\b[^>]*>([\s\S]*?)<\/a>/g,
];

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

// Chinese characters and full-width punctuation. Latin, digits and ordinary
// punctuation come from Geist and are left out.
const isCjk = (ch) => /[\p{Script=Han}　-〿＀-￯—…‧・]/u.test(ch);

/** Every Chinese character used in a heading-font place of one locale's pages. */
function neededChars(locale) {
  const dir = join(DIST, locale);
  if (!existsSync(dir)) return null;
  const chars = new Set(ALWAYS);
  for (const file of walk(dir).filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ');
    for (const place of PLACES) {
      for (const match of html.matchAll(place)) {
        const text = decode(match[2].replace(/<[^>]+>/g, ' '));
        for (const ch of text) if (isCjk(ch)) chars.add(ch);
      }
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    return {};
  }
}

function check() {
  const manifest = readManifest();
  let missingTotal = 0;
  for (const target of TARGETS) {
    const needed = neededChars(target.locale);
    if (needed === null) {
      console.log(`fonts:check  dist/${target.locale}/ not found. Run \`npm run build\` first.`);
      return WARN_ONLY ? 0 : 1;
    }
    const have = new Set(manifest[target.locale] || '');
    const missing = [...needed].filter((ch) => !have.has(ch));
    missingTotal += missing.length;
    if (missing.length) {
      console.log(`fonts:check  ${target.file} lacks ${missing.length} character(s) used in ${target.locale} headings: ${missing.join('')}`);
    }
  }
  if (missingTotal === 0) {
    console.log('fonts:check  the Chinese heading fonts cover every heading, menu and button character.');
    return 0;
  }
  console.log('fonts:check  those characters are drawn in the system font until you run `npm run fonts:cjk` and commit the result.');
  return WARN_ONLY ? 0 : 1;
}

function findPython() {
  const candidates = [process.env.PYTHON, 'python', 'python3'].filter(Boolean);
  for (const exe of candidates) {
    const probe = spawnSync(exe, ['-c', 'import fontTools, brotli'], { stdio: 'ignore' });
    if (probe.status === 0) return exe;
  }
  return null;
}

async function download(url, to) {
  console.log(`fonts:cjk  downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed (${response.status}): ${url}`);
  writeFileSync(to, Buffer.from(await response.arrayBuffer()));
}

function run(python, moduleArgs) {
  const result = spawnSync(python, ['-m', 'fontTools', ...moduleArgs], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.status !== 0) throw new Error(`fontTools ${moduleArgs[0]} failed`);
}

async function rebuild() {
  const python = findPython();
  if (!python) {
    console.error('fonts:cjk  needs Python 3 with fonttools and brotli:  pip install fonttools brotli');
    console.error('           (set PYTHON to the interpreter if it is not on PATH)');
    return 1;
  }
  mkdirSync(OUT, { recursive: true });
  mkdirSync(CACHE, { recursive: true });
  const manifest = { note: 'Characters in the Chinese heading fonts. Written by scripts/subset-cjk.mjs; do not edit.', weight: WEIGHT };

  for (const target of TARGETS) {
    const needed = neededChars(target.locale);
    if (needed === null) {
      console.error(`fonts:cjk  dist/${target.locale}/ not found. Run \`npm run build\` first.`);
      return 1;
    }
    const source = option(target.flag) || join(CACHE, target.source);
    if (!existsSync(source)) await download(target.url, source);

    const textFile = join(CACHE, `${target.locale}.txt`);
    const subsetFile = join(CACHE, `${target.locale}-subset.ttf`);
    const staticFile = join(CACHE, `${target.locale}-${WEIGHT}.ttf`);
    const outFile = join(OUT, target.file);
    writeFileSync(textFile, needed, 'utf8');

    // 1. keep only the needed characters (still a variable font),
    // 2. freeze the weight axis at 600,
    // 3. compress to woff2.
    run(python, [
      'subset',
      source,
      `--text-file=${textFile}`,
      `--output-file=${subsetFile}`,
      '--layout-features=kern,palt,locl,ccmp',
      '--name-IDs=0,1,2,3,4,6,13,14',
      '--notdef-outline',
      '--no-hinting',
      '--drop-tables+=DSIG',
    ]);
    run(python, ['varLib.instancer', subsetFile, `wght=${WEIGHT}`, '-o', staticFile]);
    run(python, ['ttLib.woff2', 'compress', staticFile, '-o', outFile]);

    manifest[target.locale] = needed;
    const kb = (statSync(outFile).size / 1024).toFixed(1);
    console.log(`fonts:cjk  ${target.file}: ${[...needed].length} characters, ${kb} KB`);
  }

  const licence = join(OUT, LICENCE.file);
  if (!existsSync(licence)) await download(LICENCE.url, licence);
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('fonts:cjk  done. Commit public/fonts/*.woff2 and src/layouts/cjk-head-chars.json, then build again.');
  return 0;
}

let code;
try {
  code = CHECK ? check() : await rebuild();
} catch (error) {
  console.error(`fonts:${CHECK ? 'check' : 'cjk'}  ${error instanceof Error ? error.message : error}`);
  code = CHECK && WARN_ONLY ? 0 : 1;
}
process.exit(code);
