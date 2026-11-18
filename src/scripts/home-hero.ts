// Home hero: the leverage slider drives the headline, the bar and the figures.
// Browser script. Imports only dependency-free modules (never src/i18n/*,
// which would pull the OpenCC dictionary into the bundle); the strings arrive
// as JSON in the data-hero attribute.
import { liquidationPrice, roomLeft, roundToTick } from '../lib/calc/liquidation';
import { fmt, formatNumber, formatPercent } from '../lib/fmt';

interface HeroData {
  entry: number;
  mmr: number;
  calculatorHref: string;
  strings: {
    head: string;
    levFormat: string;
    barLabel: string;
    liquidation: string;
    sub: string;
    sliderText: string;
  };
}

const MIN = 2;
const MAX = 100;

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  const slider = document.querySelector<HTMLInputElement>('#hero-lev');
  const number = document.querySelector<HTMLInputElement>('#hero-lev-n');
  const bar = document.querySelector<HTMLElement>('#hero-scale');
  if (!root || !slider || !number || !bar) return;

  let data: HeroData;
  try {
    data = JSON.parse(root.dataset.hero || '') as HeroData;
  } catch {
    return; // leave the server-rendered example as it is
  }
  const s = data.strings;
  const head = document.querySelector<HTMLElement>('#hero-head');
  const liq = document.querySelector<HTMLElement>('#hero-liq');
  const sub = document.querySelector<HTMLElement>('#hero-sub');
  const primary = root.querySelector<HTMLAnchorElement>('[data-cta-action="primary"]');

  function render(leverage: number): void {
    const room = roomLeft(leverage, data.mmr);
    const result = liquidationPrice({ side: 'long', entryPrice: data.entry, leverage, mmr: data.mmr });
    const price = result.ok ? roundToTick(result.liquidationPrice, 1) : 0;
    const lev = fmt(s.levFormat, { n: leverage });
    const pct = formatPercent(room);

    bar!.style.setProperty('--room', room.toFixed(4));
    bar!.setAttribute('aria-label', fmt(s.barLabel, { pct }));
    if (head) head.textContent = fmt(s.head, { lev });
    if (liq) liq.textContent = fmt(s.liquidation, { price: formatNumber(price) });
    if (sub) sub.textContent = fmt(s.sub, { pct });
    slider!.setAttribute('aria-valuetext', fmt(s.sliderText, { lev, pct }));
    if (primary) primary.href = `${data.calculatorHref}?lev=${leverage}`;
  }

  const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)));

  slider.addEventListener('input', () => {
    const leverage = clamp(Number(slider.value));
    number.value = String(leverage);
    render(leverage);
  });

  // Typing: follow valid numbers as they are typed, tidy the box on blur.
  number.addEventListener('input', () => {
    const typed = Number(number.value);
    if (!Number.isFinite(typed) || typed < MIN || typed > MAX) return;
    const leverage = clamp(typed);
    slider.value = String(leverage);
    render(leverage);
  });
  number.addEventListener('blur', () => {
    const typed = Number(number.value);
    const leverage = Number.isFinite(typed) && number.value.trim() !== '' ? clamp(typed) : clamp(Number(slider.value));
    number.value = String(leverage);
    slider.value = String(leverage);
    render(leverage);
  });

  render(clamp(Number(slider.value)));
}

init();
