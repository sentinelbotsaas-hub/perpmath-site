// Sharpe ratio calculator, browser side.
// - reads the pasted returns and the two settings, runs src/lib/calc/sharpe.ts,
//   updates the result panel, the interval axis and the table
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
// Everything below the call to sharpe() is presentation (sharpe-view.ts).
import { createResultView, initActions, parseNumber, setFlag } from '../components/calc/calc-ui';
import { updateIntervalAxis } from '../components/calc/interval-axis';
import { sharpeView } from '../components/calc/sharpe-view';
import type { SharpeViewStrings } from '../components/calc/sharpe-view';
import { setToned } from '../components/calc/signed';
import { parseReturns, sharpe } from '../lib/calc/sharpe';
import type { SharpeIssue } from '../lib/calc/sharpe';
import { fmt, formatNumber } from '../lib/fmt';

interface CalcData {
  /** Fewer returns than this carry the small-sample warning. */
  min: number;
  /** Most returns the calculator accepts. */
  max: number;
  strings: SharpeViewStrings & {
    invalid: string;
    errors: Record<'tooFew' | 'tooMany' | 'rejected' | 'flat' | 'riskFreeRate' | 'periodsPerYear', string>;
  };
}

const STORAGE_KEY = 'perpmath:sharpe:v1';
const PARAMS = ['returns', 'rf', 'periods'] as const;
type Param = (typeof PARAMS)[number];
type State = Record<Param, string>;
/** Longest list of returns that is put into the address. A longer one stays in the page and in localStorage. */
const MAX_QUERY = 6000;
/** Longest text accepted from a link or from storage. */
const MAX_TEXT = 80000;
/** How many unreadable entries the error message names. */
const SHOWN = 3;

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
  const inputs: Record<Param, HTMLInputElement | HTMLTextAreaElement | null> = {
    returns: $<HTMLTextAreaElement>('#returns'),
    rf: $<HTMLInputElement>('#rf'),
    periods: $<HTMLInputElement>('#periods'),
  };
  const axis = $('#calc-span');
  if (PARAMS.some((key) => !inputs[key]) || !axis) return;

  const view = createResultView();

  // ---- state: URL first, then localStorage, then the server defaults ------
  function readState(): State {
    return {
      returns: inputs.returns!.value.trim(),
      rf: inputs.rf!.value.trim(),
      periods: inputs.periods!.value.trim(),
    };
  }

  function applyState(state: Partial<State>): void {
    if (typeof state.returns === 'string') inputs.returns!.value = state.returns.slice(0, MAX_TEXT);
    if (typeof state.rf === 'string') inputs.rf!.value = state.rf.slice(0, 24);
    if (typeof state.periods === 'string') inputs.periods!.value = state.periods.slice(0, 24);
  }

  function loadState(): void {
    const query = new URLSearchParams(window.location.search);
    const fromUrl: Partial<State> = {};
    for (const key of PARAMS) {
      const value = query.get(key);
      if (value !== null) fromUrl[key] = value;
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
    // The list goes into the link as one compact line.
    const compact = state.returns.split(/[\s,;，；、]+/).filter(Boolean).join(',');
    if (compact !== '' && compact.length <= MAX_QUERY) query.set('returns', compact);
    if (state.rf !== '') query.set('rf', state.rf);
    if (state.periods !== '') query.set('periods', state.periods);
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
  function showErrors(messages: Partial<Record<Param, string>>): void {
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
  const cell = (id: string) => document.getElementById(id);
  function setText(id: string, text: string): void {
    const el = cell(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function showInvalid(messages: Partial<Record<Param, string>>, sentence = s.invalid): void {
    showErrors(messages);
    view.show({ figure: s.noValue, sentence, state: 'invalid' });
    updateIntervalAxis(axis!, { low: Number.NaN, high: Number.NaN, point: Number.NaN }, { range: s.noValue, value: s.noValue, caption: sentence });
    for (const id of ['out-count', 'out-deviation', 'out-sharpe', 'out-factor', 'out-se', 'out-interval', 'out-t']) setText(id, s.noValue);
    setToned(cell('out-mean'), s.noValue, undefined);
    setFlag('calc-small', null);
  }

  function render(save: boolean): void {
    const state = readState();
    const parsed = parseReturns(state.returns);
    const periodsPerYear = parseNumber(state.periods);
    // The risk-free rate is optional: an empty field is 0.
    const riskFreeRate = state.rf === '' ? 0 : parseNumber(state.rf) / 100;

    const messages: Partial<Record<Param, string>> = {};
    if (parsed.rejected.length > 0) {
      const named = parsed.rejected.slice(0, SHOWN).map((token) => token.slice(0, 16));
      const more = parsed.rejected.length > SHOWN ? ` (+${parsed.rejected.length - SHOWN})` : '';
      messages.returns = fmt(s.errors.rejected, { tokens: `${named.join('  ')}${more}` });
    }

    const result = sharpe({ returns: parsed.values, riskFreeRate, periodsPerYear });
    if (!result.ok || messages.returns) {
      const issues: SharpeIssue[] = result.ok ? [] : result.issues;
      if (!messages.returns) {
        if (issues.includes('tooFew')) messages.returns = s.errors.tooFew;
        else if (issues.includes('tooMany')) {
          messages.returns = fmt(s.errors.tooMany, { max: formatNumber(data.max), n: formatNumber(parsed.values.length) });
        } else if (issues.includes('flat')) messages.returns = s.errors.flat;
      }
      if (issues.includes('riskFreeRate')) messages.rf = s.errors.riskFreeRate;
      if (issues.includes('periodsPerYear')) messages.periods = s.errors.periodsPerYear;
      // A deviation of zero is a property of the data, not a typo: the result says so in full.
      showInvalid(messages, messages.returns === s.errors.flat ? s.errors.flat : s.invalid);
    } else {
      showErrors({});
      const v = sharpeView(result, periodsPerYear, s);
      view.show({ figure: v.figure, sentence: v.sentence, state: v.state });
      updateIntervalAxis(axis!, v.axis, { range: v.axis.range, value: v.axis.value, caption: v.axis.caption });
      setText('out-count', v.count);
      setToned(cell('out-mean'), v.mean.text, v.mean.tone);
      setText('out-deviation', v.deviation);
      setText('out-sharpe', v.sharpe);
      setText('out-factor', v.factor);
      setText('out-se', v.se);
      setText('out-interval', v.interval);
      setText('out-t', v.t);
      setFlag('calc-small', v.flag);
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
  render(false);
}

init();
