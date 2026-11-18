// Generates vercel.json from site.config.mjs.
//
//   node scripts/gen-vercel.mjs          write vercel.json
//   node scripts/gen-vercel.mjs --check  exit 1 if vercel.json is out of date
//
// How the gate works (Vercel docs, "redirects" in vercel.json):
// - a redirect may carry `has` / `missing` conditions of type "header";
// - Vercel sets the request header `x-vercel-ip-country` (ISO 3166-1 alpha-2).
// For each exit path we emit one rule per gated country (`has` that country
// -> /not-available/) and one rule for everybody else (`missing` every gated
// country -> the real target). The two kinds of rule can never both match,
// so the result does not depend on the order Vercel evaluates them in.
// Each rule is emitted for the path with and without the trailing slash.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXITS, NOT_AVAILABLE_PATH, gatedCountries } from '../site.config.mjs';

const OUT = fileURLToPath(new URL('../vercel.json', import.meta.url));
const HEADER = 'x-vercel-ip-country';

export function buildVercelConfig() {
  const countries = gatedCountries();
  // One host only: www answers with a permanent redirect to the apex.
  const redirects = [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'www.perpmath.com' }],
      destination: 'https://perpmath.com/:path*',
      permanent: true,
    },
  ];
  for (const [path, target] of Object.entries(EXITS)) {
    const sources = [path, path.replace(/\/$/, '')];
    for (const source of sources) {
      for (const country of countries) {
        redirects.push({
          source,
          has: [{ type: 'header', key: HEADER, value: country }],
          destination: NOT_AVAILABLE_PATH,
          permanent: false,
        });
      }
      redirects.push({
        source,
        // The header must be present: a request with no country falls through
        // to the static /go/ page instead of being sent to the exchange.
        has: [{ type: 'header', key: HEADER }],
        missing: countries.map((country) => ({ type: 'header', key: HEADER, value: country })),
        destination: target,
        permanent: false,
      });
    }
  }
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: 'astro',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    trailingSlash: true,
    redirects,
    headers: [
      {
        source: '/go/(.*)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ],
  };
}

export function renderVercelConfig() {
  return JSON.stringify(buildVercelConfig(), null, 2) + '\n';
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const next = renderVercelConfig();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
    } catch {
      // missing file counts as out of date
    }
    if (current !== next) {
      console.error('vercel.json is out of date. Run: npm run gen:vercel');
      process.exit(1);
    }
    console.log('vercel.json is up to date.');
  } else {
    writeFileSync(OUT, next);
    console.log(`Wrote vercel.json (${buildVercelConfig().redirects.length} redirects).`);
  }
}
