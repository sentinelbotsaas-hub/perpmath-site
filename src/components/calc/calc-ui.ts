// Display helpers shared by the four calculator scripts: the result panel,
// the slider that mirrors a number field, the advanced-settings fold, and the
// reset and copy buttons. Presentation only. No formula lives here; every
// number these functions print is handed to them by a script that got it from
// src/lib/calc/.
//
// Safe to import from a browser script: the only dependency is src/lib/fmt.ts.
// The strings arrive as JSON in data-calc-ui on the shell (CalculatorShell.astro).
import { fmt } from '../../lib/fmt';

/** "68,000" -> 68000. Empty or unreadable text -> NaN. */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/[,\s]/g, '');
  if (cleaned === '') return Number.NaN;
  return Number(cleaned);
}

export interface Figure {
  /** The number, with its sign, separators and a trailing percent sign: "64,824.4", "100.00%". */
  value: string;
  /** What follows the number: "USDT", "BTC", "x". Empty when there is none. */
  unit: string;
  /** True when the unit is written against the number ("18x"), false when a space separates them. */
  tight: boolean;
}

/**
 * Split a formatted result into the number and its unit, so that the unit can
 * be set smaller: "0.0625 BTC" -> 0.0625 + BTC, "18x" -> 18 + x.
 * Text that does not start with a number ("n/a") comes back whole.
 */
export function splitFigure(text: string): Figure {
  const match = /^([+\-−]?[\d.,]+%?)(\s*)(.*)$/.exec(text.trim());
  if (!match || match[1] === '') return { value: text, unit: '', tight: false };
  return { value: match[1], unit: match[3], tight: match[2] === '' && match[3] !== '' };
}

/**
 * ready    a result
 * caution  a result the reader must not act on as it stands (the stop comes
 *          after liquidation, no leverage works, the position cannot be liquidated)
 * invalid  no result: an input has to be fixed first
 */
export type ResultState = 'ready' | 'caution' | 'invalid';

export interface ResultView {
  /** The panel, or null when the page has none. */
  panel: HTMLElement | null;
  show(result: { figure: string; unit?: string; tight?: boolean; sentence: string; state: ResultState }): void;
  /** The same, from one formatted text such as "18x" or "0.0625 BTC": the unit is split off for you. */
  showText(result: { text: string; sentence: string; state: ResultState }): void;
  /** Label, figure and sentence as plain lines, for the clipboard. */
  text(): string[];
  state(): ResultState;
}

/** The result panel CalculatorShell.astro rendered: #calc-figure, #calc-unit, #calc-sentence. */
export function createResultView(): ResultView {
  const $ = (selector: string) => document.querySelector<HTMLElement>(selector);
  const panel = $('#calc-result');
  const figure = $('#calc-figure');
  const unit = $('#calc-unit');
  const sentence = $('#calc-sentence');
  const label = $('#calc-label');
  const peek = $('[data-calc-peek]');
  let current: ResultState = panel?.dataset.state === 'caution' ? 'caution' : 'ready';

  if (figure) figure.addEventListener('animationend', () => figure.classList.remove('is-updated'));

  const view: ResultView = {
    panel,
    showText(result) {
      const parts = splitFigure(result.text);
      view.show({ figure: parts.value, unit: parts.unit, tight: parts.tight, sentence: result.sentence, state: result.state });
    },
    show(result) {
      const unitText = result.state === 'invalid' ? '' : (result.unit ?? '');
      if (figure && figure.textContent !== result.figure) {
        figure.textContent = result.figure;
        // One short fade so that a changed figure is noticed. Opacity only.
        figure.classList.remove('is-updated');
        void figure.offsetWidth;
        figure.classList.add('is-updated');
      }
      if (unit) {
        if (unit.textContent !== unitText) unit.textContent = unitText;
        unit.toggleAttribute('data-tight', !!result.tight);
      }
      if (sentence && sentence.textContent !== result.sentence) sentence.textContent = result.sentence;
      if (panel) panel.dataset.state = result.state;
      if (peek) {
        const joined = unitText ? `${result.figure}${result.tight ? '' : ' '}${unitText}` : result.figure;
        if (peek.textContent !== joined) peek.textContent = joined;
      }
      current = result.state;
    },
    text() {
      const value = [figure?.textContent ?? '', unit?.textContent ?? ''];
      const joined = unit?.hasAttribute('data-tight') ? value.join('') : value.filter(Boolean).join(' ');
      return [`${label?.textContent?.trim() ?? ''} ${joined}`.trim(), sentence?.textContent?.trim() ?? ''].filter(Boolean);
    },
    state: () => current,
  };
  return view;
}

/**
 * Keep every slider in `scope` in step with the number field it names in
 * data-for. Moving the slider writes the field; typing in the field moves the
 * slider to the nearest step (the field keeps exactly what was typed).
 * Returns a function that re-reads the fields, for after a script changed them.
 */
export function bindSliders(scope: HTMLElement): () => void {
  const pairs = Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="range"][data-for]')).flatMap((slider) => {
    const input = document.getElementById(slider.dataset.for || '');
    return input instanceof HTMLInputElement ? [{ slider, input }] : [];
  });

  const describe = (slider: HTMLInputElement, value: string) => {
    slider.setAttribute('aria-valuetext', fmt(slider.dataset.valueText || '{value}', { value }));
  };
  const follow = ({ slider, input }: (typeof pairs)[number]) => {
    const typed = parseNumber(input.value);
    if (!Number.isFinite(typed)) return; // leave the handle where it is
    const min = Number(slider.min);
    const max = Number(slider.max);
    slider.value = String(Math.min(max, Math.max(min, Math.round(typed))));
    describe(slider, input.value.trim());
  };

  for (const pair of pairs) {
    // Runs before the form's own input listener (target phase, then bubble),
    // so the calculator reads the new value from the field.
    pair.slider.addEventListener('input', () => {
      pair.input.value = pair.slider.value;
      describe(pair.slider, pair.slider.value);
    });
    pair.input.addEventListener('input', () => follow(pair));
  }
  return () => pairs.forEach(follow);
}

/**
 * Open the advanced-settings fold when one of its fields carries something
 * the reader has to see: a value that is not the default, or an error.
 * It never closes the fold; that is the reader's choice. After the page has
 * loaded, call it with "invalid": a reader who folded their own settings
 * away should only get them back when one of them is wrong.
 */
export function revealAdvanced(only: 'changed-or-invalid' | 'invalid' = 'changed-or-invalid'): void {
  const fold = document.querySelector<HTMLDetailsElement>('#calc-advanced');
  if (!fold || fold.open) return;
  const inputs = Array.from(fold.querySelectorAll<HTMLInputElement>('input'));
  const invalid = (input: HTMLInputElement) => input.getAttribute('aria-invalid') === 'true';
  const changed = (input: HTMLInputElement) => input.value !== input.defaultValue;
  if (inputs.some((input) => invalid(input) || (only === 'changed-or-invalid' && changed(input)))) fold.open = true;
}

/** A warning line under the result (ResultFlag.astro): show it with a text, or hide it. */
export function setFlag(id: string, text: string | null): void {
  const flag = document.getElementById(id);
  if (!flag) return;
  if (text !== null) {
    const slot = flag.querySelector<HTMLElement>('[data-flag-text]');
    if (slot && slot.textContent !== text) slot.textContent = text;
  }
  flag.hidden = text === null;
}

/**
 * A secondary figure (Metric.astro): write its value. With `null` it shows
 * the "no value" text instead and hides the unit, so that a unit never
 * stands next to a missing number.
 */
export function setMetric(id: string, value: string | null, noValue: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const text = value ?? noValue;
  if (el.textContent !== text) el.textContent = text;
  const unit = el.parentElement?.querySelector<HTMLElement>('.metric-unit');
  if (unit) unit.hidden = value === null;
}

interface ActionStrings {
  resetDone: string;
  copyDone: string;
  copyLinkDone: string;
  copyFail: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission refused: try the older way below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'visually-hidden';
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand('copy');
    area.remove();
    return done;
  } catch {
    return false;
  }
}

/**
 * Wire the three buttons of the shell: reset (#calc-reset), copy the result
 * (#calc-copy) and copy a link with the current inputs (#calc-copy-link).
 * What they did is said in #calc-action-status, a polite status line.
 *
 *   initActions({ view, storageKey, reset: () => { form.reset(); ... }, save: () => saveState(readState()) });
 *
 * `reset` puts the inputs back and redraws; this function clears the query
 * string and the stored state afterwards, so a reset page has the clean
 * address again. `save` writes the inputs into the address, so that a copied
 * link reproduces what is on screen.
 */
export function initActions(options: { view: ResultView; reset: () => void; save: () => void; storageKey: string }): void {
  const root = document.querySelector<HTMLElement>('[data-calc-ui]');
  let strings: ActionStrings;
  try {
    strings = JSON.parse(root?.dataset.calcUi || '') as ActionStrings;
  } catch {
    return;
  }
  const status = document.getElementById('calc-action-status');
  const say = (text: string) => {
    if (status) status.textContent = text;
  };

  document.getElementById('calc-reset')?.addEventListener('click', () => {
    options.reset();
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
    } catch {
      // Some embedded contexts forbid it.
    }
    try {
      window.localStorage.removeItem(options.storageKey);
    } catch {
      // Storage blocked.
    }
    say(strings.resetDone);
  });

  document.getElementById('calc-copy')?.addEventListener('click', () => {
    const lines = options.view.text();
    // Nothing to copy while an input is wrong: repeat what has to be fixed.
    if (options.view.state() === 'invalid') {
      say(lines[lines.length - 1] ?? '');
      return;
    }
    options.save(); // the address now carries the inputs the result was computed from
    const title = document.querySelector('h1')?.textContent?.trim() ?? '';
    void copyText([title, ...lines, window.location.href].filter(Boolean).join('\n')).then((ok) =>
      say(ok ? strings.copyDone : strings.copyFail),
    );
  });

  document.getElementById('calc-copy-link')?.addEventListener('click', () => {
    options.save();
    void copyText(window.location.href).then((ok) => say(ok ? strings.copyLinkDone : strings.copyFail));
  });

  // The strip on phones that repeats the result: once the full panel is on
  // screen it has nothing to add, so it steps aside. Its place in the flow is
  // kept (visibility), so nothing moves.
  const peek = document.querySelector<HTMLElement>('.calc-peek');
  if (peek && options.view.panel && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        for (const entry of entries) peek.toggleAttribute('data-away', entry.isIntersecting);
      },
      { rootMargin: '-120px 0px 0px 0px' },
    ).observe(options.view.panel.querySelector('.calc-primary') ?? options.view.panel);
  }
}
