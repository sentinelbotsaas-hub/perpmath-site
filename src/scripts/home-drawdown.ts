// Home page, drawdown section: the slider drives the balance that is left,
// the gain needed to recover, and the two bars.
//
// Browser script. Imports only dependency-free modules; the strings arrive as
// JSON in the data-drawdown attribute. The numbers come from
// src/lib/calc/drawdown.ts, the function the drawdown calculator uses. When
// it reports that nothing is left (a 100% drawdown), the panel prints "total
// loss" and never a percentage. The bars are <Meter>s: only their --value
// custom property and their label change.
import { drawdown } from '../lib/calc/drawdown';
import { fmt, formatNumber } from '../lib/fmt';

interface DrawdownData {
  /** The example starting balance. */
  start: number;
  strings: {
    sliderText: string;
    sliderTextTotal: string;
    lostBar: string;
    neededBar: string;
    neededBarTotal: string;
    scale: string;
    total: string;
    totalNote: string;
  };
}

/** 0.5 -> "50.00%", 9 -> "900.00%". */
const percent = (fraction: number) => `${formatNumber(fraction * 100, 2)}%`;

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-drawdown]');
  const slider = document.querySelector<HTMLInputElement>('#dd-range');
  if (!root || !slider) return;

  let data: DrawdownData;
  try {
    data = JSON.parse(root.dataset.drawdown || '') as DrawdownData;
  } catch {
    return; // leave the server-rendered example as it is
  }
  const s = data.strings;
  const $ = (id: string) => document.getElementById(id);
  const setText = (id: string, text: string) => {
    const el = $(id);
    if (el && el.textContent !== text) el.textContent = text;
  };
  const setBar = (id: string, share: number, label: string) => {
    const el = $(id);
    if (!el) return;
    el.style.setProperty('--value', Math.min(1, Math.max(0, share)).toFixed(4));
    el.setAttribute('aria-label', label);
  };

  function render(): void {
    const whole = Math.min(100, Math.max(1, Math.round(Number(slider!.value))));
    if (!Number.isFinite(whole)) return;
    setText('dd-now', `${formatNumber(whole)}%`);

    const r = drawdown({ mode: 'drawdown', drawdown: whole / 100 });
    if (!r.ok) {
      // Nothing (or next to nothing) is left: there is no finite gain to print.
      const lost = percent(1);
      setText('dd-left', formatNumber(0));
      setText('dd-needed', s.total);
      setText('dd-lost-value', lost);
      setText('dd-needed-value', s.total);
      setText('dd-scale', s.totalNote);
      setBar('dd-lost-bar', 1, fmt(s.lostBar, { lost }));
      setBar('dd-needed-bar', 0, s.neededBarTotal);
      slider!.setAttribute('aria-valuetext', s.sliderTextTotal);
      return;
    }

    const lost = percent(r.drawdown);
    const needed = percent(r.recoveryGain);
    setText('dd-left', formatNumber(data.start * r.remaining));
    setText('dd-needed', needed);
    setText('dd-lost-value', lost);
    setText('dd-needed-value', needed);
    setText('dd-scale', fmt(s.scale, { max: percent(r.scaleMax) }));
    setBar('dd-lost-bar', r.lostShare, fmt(s.lostBar, { lost }));
    setBar('dd-needed-bar', r.neededShare, fmt(s.neededBar, { needed }));
    slider!.setAttribute('aria-valuetext', fmt(s.sliderText, { lost, needed }));
  }

  slider.addEventListener('input', render);
  render();
}

init();
