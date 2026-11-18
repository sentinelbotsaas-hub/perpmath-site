# Contributing

Several people and agents work in this repository at the same time. These conventions keep them out of each other's way.

## Who owns what

| Area | Files |
| --- | --- |
| Skeleton | `src/layouts/`, `src/components/`, `src/styles/`, `src/i18n/config.ts`, `strings.ts`, `hans*.{ts,mjs,json}`, `common.ts`, `home.ts`, `pages.ts`, `liquidation.ts`, `tool-index.ts`, `src/lib/` except `calc/`, `site.config.mjs`, `astro.config.mjs` |
| Tools | `src/pages/[...locale]/tools/`, `src/lib/calc/`, `src/scripts/<tool>.ts`, `src/i18n/tools.ts` |
| Data and daily report | `scripts/`, `src/data/`, `src/pages/[...locale]/daily/`, `src/pages/[...locale]/data/`, `src/i18n/daily.ts` |
| Articles | `src/content/articles/en/`, `src/content/articles/zh-hant/`, `research/` |

If you need a change in a file you do not own (a new token, a new shared string, a new component prop), ask the owner instead of editing it. Add files freely inside your own area.

## How routing works

Every page lives once, under `src/pages/[...locale]/`. The `[...locale]` folder is an Astro rest parameter: it is empty for English and `zh-hant` or `zh-hans` for Chinese, so one file produces `/x/`, `/zh-hant/x/` and `/zh-hans/x/`. There is no per-language copy of any page.

### Add a page in three languages

1. Create `src/pages/[...locale]/<section>/<name>/index.astro`:

```astro
---
import { localeStaticPaths } from '../../../../i18n/config';
import type { Locale } from '../../../../i18n/config';
import { tools } from '../../../../i18n/tools';
import Base from '../../../../layouts/Base.astro';

export const getStaticPaths = localeStaticPaths;

interface Props {
  locale: Locale;
}

const { locale } = Astro.props;
const t = tools[locale].leverage;
---

<Base locale={locale} path="/tools/leverage-calculator/" title={t.title} description={t.description}>
  <section class="measure">
    <div class="wrap">
      <h1 class="head">{t.title}</h1>
    </div>
  </section>
</Base>
```

2. `path` is the page's address without the language prefix, with a slash at both ends. `Base` builds the canonical URL, the hreflang tags and the language switcher from it.
3. Build internal links with `localePath(locale, '/tools/')`. Never type `/zh-hant/...` by hand and never write a relative link. Every internal link ends with a slash.
4. That is all. The page appears in the sitemap. If it is a section index (`/daily/`, `/data/`, `/bot/`), its link appears in the nav and footer by itself. If it is one of the ten tools in `src/i18n/tool-index.ts`, the home page and `/tools/` start linking to it by themselves.

Pages that must not be indexed pass `noindex` to `Base` and are added to `NOT_IN_SITEMAP` in `astro.config.mjs`.

## Strings

One file per area in `src/i18n/`, all the same shape:

```ts
import { defineStrings } from './strings';

export const tools = defineStrings({
  en: { leverage: { title: 'Leverage calculator', result: 'Use at most {lev}x.' } },
  'zh-hant': { leverage: { title: '槓桿計算機', result: '最多用 {lev} 倍。' } },
});
```

- Write `en` and `zh-hant`. Both must have exactly the same keys.
- `zh-hant` uses Taiwan wording and Traditional characters only: 爆倉, 資金費率, 合約, 槓桿, 保證金, 停損, 帳戶.
- Never write `zh-hans`. It is produced from `zh-hant` by `toHans()`: OpenCC (Taiwan to Mainland, with phrases) plus the term list in `hans-overrides.json`. If a Simplified word comes out wrong, add the Traditional term and the word you want to that list (ask the skeleton owner).
- Values are plain strings, arrays or nested objects. Put variable parts in `{name}` placeholders and fill them with `fmt()` from `src/lib/fmt.ts`. Do not use functions as values.
- `npm test` checks every strings file in the folder, new ones included: same keys, same placeholders, no Simplified characters in `zh-hant`, nothing left un-converted in `zh-hans`.

## Browser scripts

- One TypeScript file per interactive page in `src/scripts/`, loaded with `<script>import '.../scripts/x.ts';</script>` placed inside `<Base>`.
- A browser script may import from `src/lib/` (`calc/`, `fmt.ts`) and from `src/i18n/config.ts`. It must not import any strings file or `hans.ts`: that would ship the OpenCC dictionary to every visitor.
- Hand strings and numbers to the script as JSON in a `data-*` attribute. See `src/pages/[...locale]/index.astro` and `src/scripts/home-hero.ts`.
- The page must be correct with scripting off: render the default result on the server and keep formulas and examples in the HTML.
- Wrap `localStorage` in `try`/`catch`. Keep calculator state in the URL query.
- Calculation code goes in `src/lib/calc/` as pure functions with a test file beside it. Exchange parameters (maintenance margin rate, tick size) are passed in by the caller from `src/data/`; never hide a default for them in the function.

## Articles

- Files: `src/content/articles/en/<slug>.md` and `src/content/articles/zh-hant/<slug>.md`. The file name must equal the `slug`.
- The same slug in two languages means the same article, translated. hreflang links only the languages in which the slug exists.
- `src/content/articles/zh-hans/` is generated before every dev and build run and is git-ignored. Do not add or edit files there.
- Frontmatter, all required. Dates are quoted strings.

```yaml
---
title: "…"
slug: "my-article"
description: "…"        # 60 to 170 characters
date: "2026-11-18"
lastmod: "2026-11-18"
lang: "zh-Hant"         # or "en"
category: "…"
tags: ["…"]
keywords: ["…"]
tldr: "…"
---
```

- In-article links to other pages include the language prefix and the closing slash: `/zh-hant/tools/liquidation-price-calculator/`. The generator turns `/zh-hant/` into `/zh-hans/`.

## Calls to action

Use `src/components/Cta.astro`. At most two actions per page.

- An action that leaves for Bybit never carries its own URL. `exit: 'bybit'` renders `/go/bybit/` (affiliate), `exit: 'bybit-testnet'` renders `/go/bybit-testnet/`. The region gate is in `vercel.json`.
- The disclosure line under the block is added for you when one of the actions is the affiliate exit.
- Every action carries `data-cta="<pageType>:<position>"`. Pick a `pageType` (`tool`, `home`, `daily`, `data`, `article`, `bot`) and a `position` (`hero`, `result`, `end`).
- Never write a bonus amount, a user count, a testimonial or any other figure that you cannot point to a source for.

## Design rules

The look comes from the wireframes (`sentinel-bot/docs/plan-edu-site/wireframes.html`, outside this repository): three surfaces, two typefaces, and every quantity drawn at its true proportion.

**Surfaces.** A surface is a full-width band with a `.wrap` inside it. Do not nest one surface in another.

| Class | Colour | Use it for |
| --- | --- | --- |
| `.measure` | coral | the bar and the inputs |
| `.verdict` | ink | the result |
| `.read` | paper | explanations, lists, documents |

The coral is a surface. Never use it for a button, a link or a highlight.

**The bar.** `<Scale room={0.0467} label="…" />`. The whole bar is 100% of something; the light part is the fraction you pass. Do not enlarge a small value to make it visible; write the number next to it. `label` is the text alternative and must state the number.

**Rules that are checked by a linter.** A violation is sent back.

- Colours and font families: only through the tokens in `src/styles/tokens.css`. No literal colour or `font-family` anywhere else.
- `padding`, `margin` and `gap`: only `--space-*` tokens (or `0`).
- No `transition`. If something must animate, animate only `transform` or `opacity`, use `animation` with `animation-fill-mode: both`, and keep the `prefers-reduced-motion` rule in `base.css` working. Today nothing animates.
- `overflow-x: clip` on `html` and `body`, never `hidden`. No `100vw`.
- Grid tracks are `minmax(0, 1fr)`. Display headings keep `overflow-wrap: break-word; min-width: 0; text-wrap: balance` (they get it from `h1` to `h3` in `base.css`).
- Labels: body typeface, sentence case, no letter-spacing, never uppercase, never monospace. Monospace (`.num`) is for numbers and code only.
- No small label above a heading. No strings joined with a middle dot. No arrow glued to link text. No emoji. No gradients. No card inside a card.
- Long and short, profit and loss: never green and red. Use words, fill and a minus sign.
- Every control has a `:focus-visible` state. Buttons have hover, active and disabled states. Anything you can tap is at least 48px tall (`--tap`).
- The container is `.wrap`: 1200px at most, centred.
- A page's first screen holds the headline, one sentence and the main action at 1280 by 800.
- Keep it short: about 80 words on any one screen. Tool pages are the exception for their formula and examples.

**Checking.** `npm run build && npm test && npm run check:dist`. For the design lint, run Hallmark's `sloplint.mjs` on `src` and on the built pages; lint tool pages with `--scope app`.

## Astro notes

- This project uses Astro 7. `compressHTML` is set to `true` so that a line break between two inline elements stays a space.
- Close every tag. The Astro 7 compiler treats an unclosed tag as an error.
- Do not put a `<script>` or `<style>` after `</Base>`: it would land after `</html>`.
