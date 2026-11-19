// Home hero: the leverage slider and the number box drive the liquidation
// price, the sentence under it and the risk ruler.
//
// Browser script. Imports only dependency-free modules (never src/i18n/*,
// which would pull the OpenCC dictionary into the bundle); the strings arrive
// as JSON in the data-hero attribute. The liquidation price is computed by
// src/lib/calc/liquidation.ts, exactly as the page does at build time; the
// ruler is redrawn with updateRiskRuler() and nothing here sets a style.
import { updateRiskRuler } from '../components/ui/risk-ruler';
import { liquidationPrice, roundToTick } from '../lib/calc/liquidation';
import { fmt, formatNumber, formatPercent } from '../lib/fmt';

interface HeroData {
  entry: number;
  mmr: number;
  tick: number;
  decimals: number;
  min: number;
  max: number;
  calculatorHref: string;
  strings: {
    levFormat: string;
    sliderText: string;
    sentence: string;
  };
}

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  const slider = document.querySelector<HTMLInputElement>('#hero-lev');
  const number = document.querySelector<HTMLInputElement>('#hero-lev-n');
  const ruler = document.querySelector<HTMLElement>('#hero-ruler');
  if (!root || !slider || !number || !ruler) return;

  let data: HeroData;
  try {
    data = JSON.parse(root.dataset.hero || '') as HeroData;
  } catch {
    return; // leave the server-rendered example as it is
  }
  const s = data.strings;
  const figure = document.querySelector<HTMLElement>('#hero-liq');
  const sentence = document.querySelector<HTMLElement>('#hero-sentence');
  // The percentage inside the sentence has its own element (it is coloured).
  let sentencePct = document.querySelector<HTMLElement>('#hero-pct');
  const open = document.querySelector<HTMLAnchorElement>('#hero-open');

  const setText = (el: HTMLElement | null, text: string) => {
    if (el && el.textContent !== text) el.textContent = text;
  };

  // The sentence is written whole each time, as new nodes: "4.67%" and
  // "49.67%" differ in width, and words that stayed in place while the figure
  // before them grew would count as a layout shift.
  const [sentenceBefore = '', sentenceAfter = ''] = s.sentence.split('{pct}');
  const writeSentence = (pct: string) => {
    if (!sentence) return;
    const next = sentenceBefore + pct + sentenceAfter;
    if (sentence.textContent === next) return;
    if (!sentencePct) {
      sentence.textContent = next;
      return;
    }
    const figure = sentencePct.cloneNode(false) as HTMLElement;
    figure.textContent = pct;
    sentence.replaceChildren(sentenceBefore, figure, sentenceAfter);
    sentencePct = figure;
  };

  function render(leverage: number): void {
    const result = liquidationPrice({ side: 'long', entryPrice: data.entry, leverage, mmr: data.mmr });
    // Cannot happen inside min..max; if it ever does, keep what is on screen.
    if (!result.ok || !result.reachable) return;
    const price = roundToTick(result.liquidationPrice, data.tick);
    const layout = updateRiskRuler(ruler!, { entry: data.entry, liquidation: price, side: 'long' });
    if (!layout || !layout.ok) return;

    const lev = fmt(s.levFormat, { n: leverage });
    const pct = formatPercent(layout.distance);
    setText(figure, formatNumber(price, data.decimals));
    writeSentence(pct);
    slider!.setAttribute('aria-valuetext', fmt(s.sliderText, { lev, pct }));
    if (open) open.href = `${data.calculatorHref}?lev=${leverage}`;
  }

  const clamp = (n: number) => Math.min(data.max, Math.max(data.min, Math.round(n)));
  const usable = (text: string) => {
    const typed = Number(text);
    return text.trim() !== '' && Number.isFinite(typed) && typed >= data.min && typed <= data.max;
  };

  slider.addEventListener('input', () => {
    const leverage = clamp(Number(slider.value));
    number.value = String(leverage);
    number.removeAttribute('aria-invalid');
    render(leverage);
  });

  // Typing: follow valid numbers as they are typed, mark the box while the
  // text is not a leverage between min and max, tidy it on blur.
  number.addEventListener('input', () => {
    if (!usable(number.value)) {
      number.setAttribute('aria-invalid', 'true');
      return;
    }
    number.removeAttribute('aria-invalid');
    const leverage = clamp(Number(number.value));
    slider.value = String(leverage);
    render(leverage);
  });
  number.addEventListener('blur', () => {
    const typed = Number(number.value);
    const leverage = Number.isFinite(typed) && number.value.trim() !== '' ? clamp(typed) : clamp(Number(slider.value));
    number.value = String(leverage);
    number.removeAttribute('aria-invalid');
    slider.value = String(leverage);
    render(leverage);
  });

  render(clamp(Number(slider.value)));
}

init();
