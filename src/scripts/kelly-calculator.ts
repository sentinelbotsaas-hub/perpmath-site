// Kelly criterion calculator, browser side.
// - reads the inputs, runs src/lib/calc/kelly.ts, updates the result panel,
//   the two bars (full Kelly, half Kelly) and the figures under them
// - when the formula returns zero or less it shows "No bet", never a negative
//   share
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
// Everything below the calls to kelly() and growthAt() is presentation.
import { bindSliders, createResultView, initActions, parseNumber, setMetric } from '../components/calc/calc-ui';
import { percent, signed, signedPercent, typedNumber, typedPercent } from '../components/calc/figures';
import { updateScaleBars } from '../components/calc/scale-bars';
import { growthAt, kelly } from '../lib/calc/kelly';
import type { KellyIssue } from '../lib/calc/kelly';
import { fmt, formatNumber } from '../lib/fmt';

interface CalcData {
  maxPayoff: number;
  /** How far below the typed win rate the "true" one is set, as a fraction, to show what an overestimate costs. */
  shift: number;
  strings: {
    winText: string;
    fullBar: string;
    halfBar: string;
    barLabel: string;
    barLabelNoBet: string;
    noBet: string;
    sentence: string;
    sentenceNoBet: string;
    edge: string;
    lowLabel: string;
    lowGrowthLabel: string;
    invalid: string;
    noValue: string;
    errors: Record<'winRate' | 'payoff', string>;
  };
}

const STORAGE_KEY = 'perpmath:kelly:v1';
const PARAMS = ['win', 'payoff'] as const;
type Param = (typeof PARAMS)[number];
type State = Record<Param, string>;

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

  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
  const inputs: Record<Param, HTMLInputElement | null> = {
    win: $<HTMLInputElement>('#win'),
    payoff: $<HTMLInputElement>('#payoff'),
  };
  const bars = $('#calc-bars');
  const outGrowthFull = $('#out-growth-full');
  const outGrowthHalf = $('#out-growth-half');
  const outGrowthQuarter = $('#out-growth-quarter');
  const outLowLabel = $('#out-low-label');
  const outLow = $('#out-low');
  const outLowGrowthLabel = $('#out-low-growth-label');
  const outLowGrowth = $('#out-low-growth');
  if (!inputs.win || !inputs.payoff || !bars) return;

  const view = createResultView();
  const syncSliders = bindSliders(form);

  // ---- state: URL first, then localStorage, then the server defaults ------
  function readState(): State {
    return { win: inputs.win!.value.trim(), payoff: inputs.payoff!.value.trim() };
  }

  function applyState(state: Partial<State>): void {
    for (const key of PARAMS) {
      const value = state[key];
      if (typeof value === 'string') inputs[key]!.value = value;
    }
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
  const fieldOf: Record<KellyIssue, Param> = { winRate: 'win', payoff: 'payoff' };

  function showErrors(issues: KellyIssue[]): void {
    const messages: Partial<Record<Param, string>> = {};
    for (const issue of issues) messages[fieldOf[issue]] = fmt(s.errors[issue], { max: formatNumber(data.maxPayoff) });
    for (const key of PARAMS) {
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
  }

  // ---- render --------------------------------------------------------------
  function setText(el: HTMLElement | null, text: string): void {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function render(save: boolean): void {
    const state = readState();
    const winRate = parseNumber(state.win) / 100;
    const payoff = parseNumber(state.payoff);
    const result = kelly({ winRate, payoff });

    if (!result.ok) {
      showErrors(result.issues);
      view.show({ figure: s.noValue, sentence: s.invalid, state: 'invalid' });
      updateScaleBars(bars!, { a: Number.NaN, b: Number.NaN }, { aValue: s.noValue, bValue: s.noValue, caption: () => s.invalid });
      for (const id of ['out-half', 'out-quarter', 'out-edge']) setMetric(id, null, s.noValue);
      for (const cell of [outGrowthFull, outGrowthHalf, outGrowthQuarter, outLow, outLowGrowth]) setText(cell, s.noValue);
    } else {
      showErrors([]);
      const win = typedPercent(winRate);
      const edge = fmt(s.edge, { value: signed(result.edge) });
      const full = percent(result.full);
      const half = percent(result.half);
      const quarter = percent(result.quarter);

      // What the same inputs give when the true win rate is `shift` lower.
      const lowWin = winRate - data.shift;
      const low = kelly({ winRate: lowWin, payoff });
      const lowText = typedPercent(lowWin);
      setText(outLowLabel, fmt(s.lowLabel, { win: low.ok ? lowText : win }));
      setText(outLowGrowthLabel, fmt(s.lowGrowthLabel, { win: low.ok ? lowText : win, full }));
      setText(outLow, low.ok ? (low.bet ? percent(low.full) : s.noBet) : s.noValue);

      setMetric('out-edge', edge, s.noValue);

      if (result.bet) {
        updateScaleBars(
          bars!,
          { a: result.full, b: result.half, max: 1 },
          { aValue: full, bValue: half, caption: () => fmt(s.barLabel, { full, half }) },
        );
        setMetric('out-half', half, s.noValue);
        setMetric('out-quarter', quarter, s.noValue);
        setText(outGrowthFull, signedPercent(result.growthFull));
        setText(outGrowthHalf, signedPercent(result.growthHalf));
        setText(outGrowthQuarter, signedPercent(result.growthQuarter));
        setText(outLowGrowth, low.ok ? signedPercent(growthAt(lowWin, payoff, result.full)) : s.noValue);
        view.showText({
          text: full,
          sentence: fmt(s.sentence, { win, payoff: typedNumber(payoff), full, half, quarter }),
          state: 'ready',
        });
      } else {
        // No edge: the formula's zero or negative share is shown as "No bet".
        updateScaleBars(
          bars!,
          { a: 0, b: 0, max: 1 },
          { aValue: s.noBet, bValue: s.noBet, caption: () => s.barLabelNoBet },
        );
        setMetric('out-half', s.noBet, s.noValue);
        setMetric('out-quarter', s.noBet, s.noValue);
        for (const cell of [outGrowthFull, outGrowthHalf, outGrowthQuarter, outLowGrowth]) setText(cell, s.noValue);
        view.show({
          figure: s.noBet,
          sentence: fmt(s.sentenceNoBet, { win, payoff: typedNumber(payoff), edge }),
          state: 'caution',
        });
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
      syncSliders();
      render(false);
    },
  });

  loadState();
  syncSliders();
  render(false);
}

init();
