// Drawdown calculator, browser side.
// - reads the inputs, runs src/lib/calc/drawdown.ts, updates the result panel,
//   the two bars (lost, needed to recover) and the figures under them
// - shows the fields of the chosen starting point only (a drawdown, or a
//   losing streak)
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
// Everything below the call to drawdown() is presentation.
import { bindSliders, createResultView, initActions, parseNumber, setMetric } from '../components/calc/calc-ui';
import { updateScaleBars } from '../components/calc/scale-bars';
import { drawdown } from '../lib/calc/drawdown';
import type { DrawdownInput, DrawdownIssue } from '../lib/calc/drawdown';
import { fmt, formatNumber } from '../lib/fmt';

interface CalcData {
  maxStreak: number;
  /** Smallest share of the balance that is still reported, as a fraction. */
  minRemaining: number;
  strings: {
    lostBar: string;
    neededBar: string;
    ddText: string;
    barLabel: string;
    figure: string;
    drawdown: string;
    streak: string;
    invalid: string;
    noValue: string;
    errors: Record<'drawdown' | 'losses' | 'risk' | 'wipedOut', string>;
  };
}

const STORAGE_KEY = 'perpmath:drawdown:v1';
const PARAMS = ['mode', 'dd', 'n', 'risk'] as const;
type Param = (typeof PARAMS)[number];
type State = Record<Param, string>;
type FieldKey = 'dd' | 'n' | 'risk';
type Mode = 'drawdown' | 'streak';

/** 0.2239 -> "22.39%", 9 -> "900.00%", with thousands separators. */
const percent = (fraction: number) => `${formatNumber(fraction * 100, 2)}%`;

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
  const inputs: Record<FieldKey, HTMLInputElement | null> = {
    dd: $<HTMLInputElement>('#dd'),
    n: $<HTMLInputElement>('#n'),
    risk: $<HTMLInputElement>('#risk'),
  };
  const modes = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="mode"]'));
  const groups = Array.from(form.querySelectorAll<HTMLElement>('[data-mode]'));
  const bars = $('#calc-bars');
  if (!inputs.dd || !inputs.n || !inputs.risk || !bars) return;

  const view = createResultView();
  const syncSliders = bindSliders(form);

  // ---- state: URL first, then localStorage, then the server defaults ------
  const currentMode = (): Mode => (modes.find((r) => r.checked)?.value === 'streak' ? 'streak' : 'drawdown');

  function readState(): State {
    return {
      mode: currentMode(),
      dd: inputs.dd!.value.trim(),
      n: inputs.n!.value.trim(),
      risk: inputs.risk!.value.trim(),
    };
  }

  function applyState(state: Partial<State>): void {
    if (state.mode === 'drawdown' || state.mode === 'streak') {
      for (const radio of modes) radio.checked = radio.value === state.mode;
    }
    if (typeof state.dd === 'string') inputs.dd!.value = state.dd;
    if (typeof state.n === 'string') inputs.n!.value = state.n;
    if (typeof state.risk === 'string') inputs.risk!.value = state.risk;
  }

  function loadState(): void {
    const query = new URLSearchParams(window.location.search);
    const fromUrl: Partial<State> = {};
    for (const key of PARAMS) {
      const value = query.get(key);
      if (value !== null) fromUrl[key] = value.slice(0, 24);
    }
    if (Object.keys(fromUrl).length > 0) {
      // A link with only a streak in it means the streak mode.
      if (!fromUrl.mode && fromUrl.dd === undefined && (fromUrl.n !== undefined || fromUrl.risk !== undefined)) {
        fromUrl.mode = 'streak';
      }
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
    // Only the fields of the chosen mode go into the link.
    const keys: Param[] = state.mode === 'streak' ? ['mode', 'n', 'risk'] : ['mode', 'dd'];
    const query = new URLSearchParams();
    for (const key of keys) {
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
  function showErrors(issues: DrawdownIssue[], mode: Mode): void {
    const messages: Partial<Record<FieldKey, string>> = {};
    const put = (field: FieldKey, message: string) => {
      if (!messages[field]) messages[field] = message; // one message per field, the first one
    };
    for (const issue of issues) {
      if (issue === 'drawdown') put('dd', s.errors.drawdown);
      else if (issue === 'losses') put('n', fmt(s.errors.losses, { max: formatNumber(data.maxStreak) }));
      else if (issue === 'risk') put('risk', s.errors.risk);
      else if (issue === 'wipedOut') put(mode === 'streak' ? 'n' : 'dd', fmt(s.errors.wipedOut, { min: percent(data.minRemaining) }));
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
  }

  // ---- render --------------------------------------------------------------
  function render(save: boolean): void {
    const state = readState();
    const mode = state.mode as Mode;
    for (const group of groups) group.hidden = group.dataset.mode !== mode;

    const losses = parseNumber(state.n);
    const riskPerTrade = parseNumber(state.risk) / 100;
    const input: DrawdownInput =
      mode === 'streak' ? { mode, losses, riskPerTrade } : { mode, drawdown: parseNumber(state.dd) / 100 };
    const result = drawdown(input);

    if (!result.ok) {
      showErrors(result.issues, mode);
      view.show({ figure: s.noValue, sentence: s.invalid, state: 'invalid' });
      updateScaleBars(
        bars!,
        { a: Number.NaN, b: Number.NaN },
        { aValue: s.noValue, bValue: s.noValue, caption: () => s.invalid },
      );
      setMetric('out-lost', null, s.noValue);
      setMetric('out-remaining', null, s.noValue);
    } else {
      showErrors([], mode);
      const lost = percent(result.drawdown);
      const needed = percent(result.recoveryGain);
      const remaining = percent(result.remaining);
      const scale = percent(result.scaleMax);

      // The library decides the scale: the full width is the larger of 100% and the gain needed.
      updateScaleBars(
        bars!,
        { a: result.drawdown, b: result.recoveryGain, max: result.scaleMax },
        { aValue: lost, bValue: needed, caption: () => fmt(s.barLabel, { scale, lost, needed }) },
      );
      setMetric('out-lost', lost, s.noValue);
      setMetric('out-remaining', remaining, s.noValue);
      view.showText({
        text: fmt(s.figure, { pct: needed }),
        sentence:
          mode === 'streak'
            ? fmt(s.streak, { n: formatNumber(losses), risk: percent(riskPerTrade), remaining, lost, needed })
            : fmt(s.drawdown, { lost, remaining, needed }),
        state: 'ready',
      });
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
