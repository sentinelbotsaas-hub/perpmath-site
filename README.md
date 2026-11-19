# perpmath

Source of perpmath.com: free calculators and lessons for crypto perpetual futures, in English (`/`), Traditional Chinese (`/zh-hant/`) and Simplified Chinese (`/zh-hans/`). A static site built with Astro. No backend, no login, no database.

Read `CONTRIBUTING.md` before adding a page, a string or a style.

## Requirements

- Node.js 22.23.4 or newer (Astro 7 requires it).

## Commands

Run these from this folder.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm run dev` | Start the dev server at http://localhost:4321. Generates the Simplified Chinese articles first. |
| `npm run build` | Build the site into `dist/`. Generates the Simplified Chinese articles first. |
| `npm run preview` | Serve `dist/` locally. |
| `npm test` | Run the unit tests (calculations, locale helpers, strings, generator scripts). |
| `npm run check:dist` | Check the built site: `lang`, canonical, reciprocal hreflang, internal links, Traditional or Simplified leftovers, sitemap. Run after `npm run build`. |
| `npm run gen:vercel` | Rewrite `vercel.json` from `site.config.mjs`. |
| `npm run fetch:risk-limit` | Refresh `src/data/risk-limit/BTCUSDT.json` from Bybit's public API. |

Before handing work over: `npm run build`, `npm test` and `npm run check:dist` must all pass.

## Layout

```
site.config.mjs        Exit targets and the region gate. vercel.json is generated from it.
vercel.json            Generated. Do not edit by hand.
scripts/               gen-zh-hans, gen-vercel, fetch-risk-limit, check-dist
public/                robots.txt, favicon
src/
  i18n/                config.ts (locales, URLs, hreflang), strings.ts, hans.ts, one strings file per area
  pages/[...locale]/   One file per page; each serves all three locales
  pages/go/            Static fallbacks for the exit addresses
  layouts/Base.astro   The only layout: head, nav, footer
  components/          Scale (the to-scale bar), Cta, Verdict, Field, Segmented, ToolIndex, Nav, Footer
  lib/                 calc/ (pure calculation functions), seo.ts (JSON-LD), fmt.ts, routes.ts, tools.ts
  scripts/             Browser scripts, one per interactive page
  styles/              tokens.css, base.css, components.css
  content/articles/    en/ and zh-hant/ are written by hand; zh-hans/ is generated and git-ignored
  data/risk-limit/     Snapshot of Bybit maintenance margin tiers, with its fetch date
```

## The three languages

- English and Traditional Chinese (Taiwan wording) are written by hand.
- Simplified Chinese is never written by hand. UI strings are converted at build time by `toHans()` in `src/i18n/hans.ts`; articles are converted by `scripts/gen-zh-hans.mjs`. Both use OpenCC plus the term list in `src/i18n/hans-overrides.json`.

## Exits to Bybit and the region gate

Every link that leaves for Bybit goes through `/go/bybit/` (live site, affiliate) or `/go/bybit-testnet/` (testnet). `vercel.json` redirects those two addresses: visitors from the gated countries go to `/not-available/`, everyone else goes to the target.

- Targets and the country list live in `site.config.mjs`. `BYBIT_TARGET` is the affiliate link; `AFFILIATE_ACTIVE` switches every disclosure line with it.
- Taiwan is controlled by `GATE_TW` in the same file. It is on.
- After changing `site.config.mjs`, run `npm run gen:vercel` and commit `vercel.json`. A test fails if they differ.
- The redirects only run on Vercel. Locally the two addresses show a static fallback page with no outbound link.

## Exchange data

The maintenance margin rate and tick size on the liquidation calculator and the home page come from `src/data/risk-limit/BTCUSDT.json`, a snapshot of Bybit's public `risk-limit` and `instruments-info` endpoints. The snapshot stores when it was fetched and the pages show that date. Refresh it with `npm run fetch:risk-limit`; the script exits non-zero and leaves the old file in place if the request fails.

## Deploying

Not set up yet. The site is meant for Vercel (`vercel.json` sets the build command and output folder). Nothing in this repository deploys by itself.
