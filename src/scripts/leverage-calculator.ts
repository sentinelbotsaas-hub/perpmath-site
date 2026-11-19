// Leverage calculator, browser side.
// - reads the inputs, runs src/lib/calc/leverage.ts, updates the result panel,
//   the two bars (stop distance, liquidation distance) and the figures
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
// Everything below the call to maxLeverage() is presentation.
import { createResultView, initActions, parseNumber, revealAdvanced, setMetric } from '../components/calc/calc-ui';
import { updateScaleBars } from '../components/calc/scale-bars';
import { maxLeverage } from '../lib/calc/leverage';
import type { MaxLeverageIssue } from '../lib/calc/leverage';
import type { Side } from '../lib/calc/liquidation';
import { roundToTick } from '../lib/calc/liquidation';
import { fmt, formatNumber, formatPercent, tickDecimals } from '../lib/fmt';

interface CalcData {
  tick: number;
  maxLeverage: number;
  strings: {
    stopBar: string;
    liqBar: string;
    barLabel: string;
    liqRow: string;
    figure: string;
    ok: string;
    capped: string;
    infeasible: string;
    limit: string;
    invalid: string;
    noValue: string;
    errors: {
      entryPrice: string;
      stopPrice: string;
      stopSideLong: string;
      stopSideShort: string;
      mmr: string;
    };
  };
}

const STORAGE_KEY = 'perpmath:leverage:v1';
const PARAMS = ['side', 'entry', 'stop', 'mmr'] as const;
type Param = (typeof PARAMS)[number];
type State = Record<Param, string>;
type FieldKey = 'entry' | 'stop' | 'mmr';

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-calc]');
  const form = document.querySelector<HTMLFormElement>('#calc-form');
  if (!root || !form) return;

  let data: CalcData;
  try {
    data = JSON.parse(root.dataset.calc || '') as CalcData;
  } catch {
    return; // keep the server-rendered example
  }
  const s = data.strings;
  const decimals = tickDecimals(data.tick);
  const showPrice = (n: number) => formatNumber(roundToTick(n, data.tick), decimals);
  /** A price the reader typed: keep whole numbers whole. */
  const showTyped = (n: number) => formatNumber(n, Number.isInteger(n) ? 0 : decimals);

  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
  const inputs: Record<FieldKey, HTMLInputElement | null> = {
    entry: $<HTMLInputElement>('#entry'),
    stop: $<HTMLInputElement>('#stop'),
    mmr: $<HTMLInputElement>('#mmr'),
  };
  const sides = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="side"]'));
  const bars = $('#calc-bars');
  const outNote = $('#calc-note');
  const outLiqLabel = $('#out-liq-label');
  if (!inputs.entry || !inputs.stop || !inputs.mmr || !bars) return;

  const view = createResultView();

  // ---- state: URL first, then localStorage, then the server defaults ------
  function readState(): State {
    return {
      side: sides.find((r) => r.checked)?.value === 'short' ? 'short' : 'long',
      entry: inputs.entry!.value.trim(),
      stop: inputs.stop!.value.trim(),
      mmr: inputs.mmr!.value.trim(),
    };
  }

  function applyState(state: Partial<State>): void {
    if (state.side === 'long' || state.side === 'short') {
      for (const radio of sides) radio.checked = radio.value === state.side;
    }
    if (typeof state.entry === 'string') inputs.entry!.value = state.entry;
    if (typeof state.stop === 'string') inputs.stop!.value = state.stop;
    if (typeof state.mmr === 'string') inputs.mmr!.value = state.mmr;
  }

  function loadState(): void {
    const query = new URLSearchParams(window.location.search);
    const fromUrl: Partial<State> = {};
    for (const key of PARAMS) {
      const value = query.get(key);
      if (value !== null) fromUrl[key] = value.slice(0, 24);
    }
    if (Object.keys(fromUrl).length > 0) {
      applyState(fromUrl);
      return;
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) applyState(JSON.parse(saved) as Partial<State>);
    } catch {
      // Storage blocked or corrupt: carry on with the defaults.
    }
  }

  function saveState(state: State): void {
    const query = new URLSearchParams();
    for (const key of PARAMS) {
      if (state[key] !== '') query.set(key, state[key]);
    }
    try {
      window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}${window.location.hash}`);
    } catch {
      // Some embedded contexts forbid it; the calculator still works.
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or storage disabled.
    }
  }

  // ---- field errors --------------------------------------------------------
  function showErrors(issues: MaxLeverageIssue[], side: Side): void {
    const messages: Partial<Record<FieldKey, string>> = {};
    const put = (field: FieldKey, message: string) => {
      if (!messages[field]) messages[field] = message; // one message per field, the first one
    };
    for (const issue of issues) {
      if (issue === 'entryPrice') put('entry', s.errors.entryPrice);
      else if (issue === 'stopPrice') put('stop', s.errors.stopPrice);
      else if (issue === 'stopSide') put('stop', side === 'long' ? s.errors.stopSideLong : s.errors.stopSideShort);
      else if (issue === 'mmr') put('mmr', s.errors.mmr);
    }
    for (const key of Object.keys(inputs) as FieldKey[]) {
      const input = inputs[key]!;
      const line = document.getElementById(`${input.id}-error`);
      const message = messages[key];
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        if (line) {
          line.textContent = message;
          line.hidden = false;
        }
      } else {
        input.removeAttribute('aria-invalid');
        if (line) {
          line.textContent = '';
          line.hidden = true;
        }
      }
    }
    // An error in a folded field has to be seen.
    if (issues.length > 0) revealAdvanced('invalid');
  }

  // ---- render --------------------------------------------------------------
  function setText(el: HTMLElement | null, text: string): void {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function render(save: boolean): void {
    const state = readState();
    const side = state.side as Side;
    const entryPrice = parseNumber(state.entry);
    const stopPrice = parseNumber(state.stop);
    const mmr = parseNumber(state.mmr) / 100;

    const result = maxLeverage({ side, entryPrice, stopPrice, mmr, maxLeverage: data.maxLeverage });

    if (!result.ok) {
      showErrors(result.issues, side);
      view.show({ figure: s.noValue, sentence: s.invalid, state: 'invalid' });
      updateScaleBars(
        bars!,
        { a: Number.NaN, b: Number.NaN },
        { aValue: s.noValue, bValue: s.noValue, caption: () => s.invalid },
      );
      if (outNote) outNote.hidden = true;
      setMetric('out-liq', null, s.noValue);
      setMetric('out-limit', null, s.noValue);
    } else {
      showErrors([], side);
      const stopPct = formatPercent(result.stopDistance);
      setMetric('out-limit', fmt(s.figure, { lev: result.limit.toFixed(2) }), s.noValue);
      if (outNote) {
        outNote.textContent = fmt(s.limit, { stop: stopPct, mmr: formatPercent(mmr), limit: result.limit.toFixed(2) });
        outNote.hidden = false;
      }

      if (result.feasible) {
        const lev = result.maxWholeLeverage;
        const liqPct = formatPercent(result.liquidationDistance);
        updateScaleBars(
          bars!,
          { a: result.stopDistance, b: result.liquidationDistance },
          {
            aValue: stopPct,
            bLabel: fmt(s.liqBar, { lev }),
            bValue: liqPct,
            caption: (layout) => fmt(s.barLabel, { max: layout.maxLabel, stop: stopPct, lev, liq: liqPct }),
          },
        );
        setText(outLiqLabel, fmt(s.liqRow, { lev }));
        setMetric('out-liq', showPrice(result.liquidationPrice), s.noValue);
        view.showText({
          text: fmt(s.figure, { lev }),
          sentence: result.cappedByExchange
            ? fmt(s.capped, { lev })
            : fmt(s.ok, { lev, stop: showTyped(stopPrice), liq: showPrice(result.liquidationPrice) }),
          state: 'ready',
        });
      } else {
        // Even 1x fails: draw the 1x liquidation distance so the bars show why.
        const atOne = 1 - mmr;
        const liqPct = formatPercent(atOne);
        updateScaleBars(
          bars!,
          { a: result.stopDistance, b: atOne },
          {
            aValue: stopPct,
            bLabel: fmt(s.liqBar, { lev: 1 }),
            bValue: liqPct,
            caption: (layout) => fmt(s.barLabel, { max: layout.maxLabel, stop: stopPct, lev: 1, liq: liqPct }),
          },
        );
        setText(outLiqLabel, fmt(s.liqRow, { lev: 1 }));
        setMetric('out-liq', null, s.noValue);
        view.show({ figure: s.noValue, sentence: s.infeasible, state: 'caution' });
      }
    }

    if (save) saveState(state);
  }

  form.addEventListener('input', () => render(true));
  form.addEventListener('change', () => render(true));
  form.addEventListener('submit', (event) => event.preventDefault());

  initActions({
    view,
    storageKey: STORAGE_KEY,
    save: () => saveState(readState()),
    reset: () => {
      form.reset();
      render(false);
    },
  });

  loadState();
  revealAdvanced();
  render(false);
}

init();
