// Risk reward calculator, browser side.
// - reads the inputs, runs src/lib/calc/risk-reward.ts, updates the result
//   panel, the two bars (risk, reward), the table under them and the meter of
//   the break-even win rate after fees
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
// Everything below the call to riskReward() is presentation.
import { createResultView, initActions, parseNumber, revealAdvanced } from '../components/calc/calc-ui';
import { amount, percent, ratioText, typedPercent } from '../components/calc/figures';
import { updateScaleBars } from '../components/calc/scale-bars';
import { riskReward } from '../lib/calc/risk-reward';
import type { RiskRewardIssue } from '../lib/calc/risk-reward';
import { fmt } from '../lib/fmt';

interface CalcData {
  strings: {
    riskBar: string;
    rewardBar: string;
    barLabel: string;
    figure: string;
    long: string;
    short: string;
    unpaid: string;
    usdt: string;
    priceShare: string;
    none: string;
    beMeter: string;
    beMeterNone: string;
    invalid: string;
    noValue: string;
    errors: Record<'entryPrice' | 'stopPrice' | 'targetPrice' | 'sameSide' | 'feeRate', string>;
  };
}

const STORAGE_KEY = 'perpmath:risk-reward:v1';
const PARAMS = ['entry', 'stop', 'target', 'fee'] as const;
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
    entry: $<HTMLInputElement>('#entry'),
    stop: $<HTMLInputElement>('#stop'),
    target: $<HTMLInputElement>('#target'),
    fee: $<HTMLInputElement>('#fee'),
  };
  const bars = $('#calc-bars');
  const outRisk = $('#out-risk');
  const outReward = $('#out-reward');
  const outBe = $('#out-be');
  const outBeNet = $('#out-be-net');
  const outRatioNet = $('#out-ratio-net');
  const outFeeStop = $('#out-fee-stop');
  const outFeeTarget = $('#out-fee-target');
  const outBeShare = $('#out-be-share');
  const meter = $('#calc-be-meter');
  if (PARAMS.some((key) => !inputs[key]) || !bars) return;

  const view = createResultView();

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
  const fieldOf: Record<RiskRewardIssue, Param> = {
    entryPrice: 'entry',
    stopPrice: 'stop',
    targetPrice: 'target',
    sameSide: 'target',
    feeRate: 'fee',
  };

  function showErrors(issues: RiskRewardIssue[]): void {
    const messages: Partial<Record<Param, string>> = {};
    for (const issue of issues) {
      const field = fieldOf[issue];
      if (!messages[field]) messages[field] = s.errors[issue]; // one message per field, the first one
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
    // An error in a folded field has to be seen.
    if (issues.length > 0) revealAdvanced('invalid');
  }

  // ---- render --------------------------------------------------------------
  function setText(el: HTMLElement | null, text: string): void {
    if (el && el.textContent !== text) el.textContent = text;
  }

  /** The break-even win rate after fees as a share of all trades: the meter's full width is 100%. */
  function setMeter(share: number | null, label: string): void {
    if (!meter) return;
    meter.style.setProperty('--value', share === null ? '0' : Math.min(1, Math.max(0, share)).toFixed(4));
    meter.setAttribute('aria-label', label);
  }

  function render(save: boolean): void {
    const state = readState();
    const feeRate = parseNumber(state.fee) / 100;
    const result = riskReward({
      entryPrice: parseNumber(state.entry),
      stopPrice: parseNumber(state.stop),
      targetPrice: parseNumber(state.target),
      feeRate,
    });

    if (!result.ok) {
      showErrors(result.issues);
      view.show({ figure: s.noValue, sentence: s.invalid, state: 'invalid' });
      updateScaleBars(bars!, { a: Number.NaN, b: Number.NaN }, { aValue: s.noValue, bValue: s.noValue, caption: () => s.invalid });
      for (const cell of [outRisk, outReward, outBe, outBeNet, outRatioNet, outFeeStop, outFeeTarget, outBeShare]) {
        setText(cell, s.noValue);
      }
      setMeter(null, s.invalid);
    } else {
      showErrors([]);
      const riskPct = percent(result.riskDistance);
      const rewardPct = percent(result.rewardDistance);
      const ratio = ratioText(result.ratio);
      const be = percent(result.breakevenWinRate);
      const fee = typedPercent(feeRate);
      const usdt = (n: number) => fmt(s.usdt, { value: amount(n) });

      updateScaleBars(
        bars!,
        { a: result.riskDistance, b: result.rewardDistance },
        {
          aValue: riskPct,
          bValue: rewardPct,
          caption: (layout) => fmt(s.barLabel, { max: layout.maxLabel, risk: riskPct, reward: rewardPct }),
        },
      );

      setText(outRisk, fmt(s.priceShare, { value: amount(result.risk), pct: riskPct }));
      setText(outReward, fmt(s.priceShare, { value: amount(result.reward), pct: rewardPct }));
      setText(outBe, be);
      setText(outFeeStop, usdt(result.feeAtStop));
      setText(outFeeTarget, usdt(result.feeAtTarget));

      const beNetValue = result.breakevenWinRateNet;
      if (beNetValue !== null) {
        const beNet = percent(beNetValue);
        setText(outBeNet, beNet);
        setText(outBeShare, beNet);
        setText(outRatioNet, fmt(s.figure, { ratio: ratioText(result.netRatio) }));
        setMeter(beNetValue, fmt(s.beMeter, { be: beNet }));
        view.showText({
          text: fmt(s.figure, { ratio }),
          sentence: fmt(result.side === 'long' ? s.long : s.short, {
            risk: amount(result.risk),
            reward: amount(result.reward),
            ratio,
            be,
            beNet,
            fee,
          }),
          state: 'ready',
        });
      } else {
        // The fees are as large as the target: say so, and print no win rate.
        setText(outBeNet, s.none);
        setText(outBeShare, s.none);
        setText(outRatioNet, s.none);
        setMeter(null, s.beMeterNone);
        view.showText({
          text: fmt(s.figure, { ratio }),
          sentence: fmt(s.unpaid, { ratio, fee, loss: amount(Math.abs(result.netReward)) }),
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
      render(false);
    },
  });

  loadState();
  revealAdvanced();
  render(false);
}

init();
