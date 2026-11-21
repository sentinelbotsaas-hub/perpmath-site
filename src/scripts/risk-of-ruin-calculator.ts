// Risk of ruin calculator, browser side.
// - reads the inputs, runs src/lib/calc/risk-of-ruin.ts, updates the result
//   panel, the two bars (within the horizon, with no end to the trading) and
//   the table under them
// - the exact figure and the bounds are redrawn on every keystroke. The Monte
//   Carlo check costs more (10,000 paths), so while the reader is typing it
//   waits for a short pause; its cell says so in the meantime
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
// Everything below the calls to riskOfRuin() and simulateRuin() is presentation.
import { bindSliders, createResultView, initActions, parseNumber, setFlag } from '../components/calc/calc-ui';
import { formatProbability, signed, signedPercent, simulationText, typedNumber, typedPercent } from '../components/calc/figures';
import { updateScaleBars } from '../components/calc/scale-bars';
import { riskOfRuin, simulateRuin } from '../lib/calc/risk-of-ruin';
import type { RuinInput, RuinIssue } from '../lib/calc/risk-of-ruin';
import { fmt, formatNumber } from '../lib/fmt';

interface CalcData {
  maxTrades: number;
  maxPayoff: number;
  /** Paths and seed of the Monte Carlo check: fixed, so the estimate is reproducible. */
  paths: number;
  seed: number;
  strings: {
    winText: string;
    withinBar: string;
    everBar: string;
    everBarCertain: string;
    barLabel: string;
    barLabelCertain: string;
    sentence: string;
    impossible: string;
    sim: string;
    simNone: string;
    simAll: string;
    simPending: string;
    eventualRange: string;
    eventualCertain: string;
    edge: string;
    noEdge: string;
    overbet: string;
    invalid: string;
    noValue: string;
    errors: Record<'winRate' | 'payoff' | 'risk' | 'threshold' | 'trades', string>;
  };
}

const STORAGE_KEY = 'perpmath:risk-of-ruin:v1';
const PARAMS = ['win', 'payoff', 'risk', 'dd', 'n'] as const;
type Param = (typeof PARAMS)[number];
type State = Record<Param, string>;

/** How long the inputs have to rest before the simulation runs, in milliseconds. */
const SIM_DELAY = 150;

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
    risk: $<HTMLInputElement>('#risk'),
    dd: $<HTMLInputElement>('#dd'),
    n: $<HTMLInputElement>('#n'),
  };
  const bars = $('#calc-bars');
  const outSim = $('#out-sim');
  const outEventual = $('#out-eventual');
  const outStreak = $('#out-streak');
  const outEdge = $('#out-edge');
  const outGrowth = $('#out-growth');
  if (PARAMS.some((key) => !inputs[key]) || !bars) return;

  const view = createResultView();
  const syncSliders = bindSliders(form);

  // ---- state: URL first, then localStorage, then the server defaults ------
  function readState(): State {
    const state = {} as State;
    for (const key of PARAMS) state[key] = inputs[key]!.value.trim();
    return state;
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
  const fieldOf: Record<RuinIssue, Param> = { winRate: 'win', payoff: 'payoff', risk: 'risk', threshold: 'dd', trades: 'n' };

  function showErrors(issues: RuinIssue[]): void {
    const messages: Partial<Record<Param, string>> = {};
    for (const issue of issues) {
      const field = fieldOf[issue];
      if (messages[field]) continue; // one message per field, the first one
      const max = issue === 'trades' ? formatNumber(data.maxTrades) : formatNumber(data.maxPayoff);
      messages[field] = fmt(s.errors[issue], { max });
    }
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

  let simTimer: number | undefined;
  /** The inputs the simulation cell currently shows, so a redraw without a change does not run it again. */
  let simKey = '';

  function runSimulation(input: RuinInput, key: string): void {
    const sim = simulateRuin(input, { paths: data.paths, seed: data.seed });
    simKey = key;
    setText(outSim, sim ? simulationText(sim, s) : s.noValue);
  }

  function render(save: boolean, wait: boolean): void {
    const state = readState();
    const input: RuinInput = {
      winRate: parseNumber(state.win) / 100,
      payoff: parseNumber(state.payoff),
      riskPerTrade: parseNumber(state.risk) / 100,
      threshold: parseNumber(state.dd) / 100,
      trades: parseNumber(state.n),
    };
    const result = riskOfRuin(input);
    window.clearTimeout(simTimer);

    if (!result.ok) {
      showErrors(result.issues);
      view.show({ figure: s.noValue, sentence: s.invalid, state: 'invalid' });
      updateScaleBars(bars!, { a: Number.NaN, b: Number.NaN }, { aValue: s.noValue, bValue: s.noValue, caption: () => s.invalid });
      for (const cell of [outSim, outEventual, outStreak, outEdge, outGrowth]) setText(cell, s.noValue);
      setFlag('calc-certain', null);
      simKey = '';
    } else {
      showErrors([]);
      const vars = {
        win: typedPercent(input.winRate),
        payoff: typedNumber(input.payoff),
        risk: typedPercent(input.riskPerTrade),
        dd: typedPercent(input.threshold),
        n: formatNumber(input.trades),
        k: result.lossesToThreshold,
        prob: formatProbability(result.probability),
      };
      const edge = fmt(s.edge, { value: signed(result.edge) });
      const growth = signedPercent(result.logGrowth);
      const eventual = result.eventual;
      const within = vars.prob;

      if (eventual.certain) {
        updateScaleBars(
          bars!,
          { a: result.probability, b: 1, max: 1 },
          {
            aLabel: fmt(s.withinBar, vars),
            aValue: within,
            bLabel: s.everBarCertain,
            bValue: formatProbability(1),
            caption: () => fmt(s.barLabelCertain, { n: vars.n, within }),
          },
        );
        setText(outEventual, s.eventualCertain);
        // Say why: no edge at all, or an edge that the size of the bet gives away.
        setFlag('calc-certain', fmt(result.edge > 1e-12 ? s.overbet : s.noEdge, { edge, risk: vars.risk, growth }));
      } else {
        const lower = formatProbability(eventual.lower);
        const upper = formatProbability(eventual.upper);
        updateScaleBars(
          bars!,
          { a: result.probability, b: eventual.upper, max: 1 },
          {
            aLabel: fmt(s.withinBar, vars),
            aValue: within,
            bLabel: s.everBar,
            bValue: upper,
            caption: () => fmt(s.barLabel, { n: vars.n, within, lower, upper }),
          },
        );
        setText(outEventual, fmt(s.eventualRange, { lower, upper }));
        setFlag('calc-certain', null);
      }

      setText(outStreak, formatNumber(result.lossesToThreshold));
      setText(outEdge, edge);
      setText(outGrowth, growth);
      view.showText({
        text: within,
        // A horizon shorter than the losing streak it would take: say that, a bare 0% explains nothing.
        sentence: fmt(result.probability === 0 ? s.impossible : s.sentence, vars),
        state: 'ready',
      });

      const key = PARAMS.map((name) => state[name]).join('|');
      if (key !== simKey) {
        if (wait) {
          setText(outSim, s.simPending);
          simKey = '';
          simTimer = window.setTimeout(() => runSimulation(input, key), SIM_DELAY);
        } else {
          runSimulation(input, key);
        }
      }
    }

    if (save) saveState(state);
  }

  form.addEventListener('input', () => render(true, true));
  form.addEventListener('change', () => render(true, true));
  form.addEventListener('submit', (event) => event.preventDefault());

  initActions({
    view,
    storageKey: STORAGE_KEY,
    save: () => saveState(readState()),
    reset: () => {
      form.reset();
      syncSliders();
      render(false, false);
    },
  });

  loadState();
  syncSliders();
  render(false, false);
}

init();
