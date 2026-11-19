// Position size calculator, browser side.
// - reads the inputs, runs src/lib/calc/position-size.ts, updates the result
//   panel, the two bars (stop distance, liquidation distance), the table
//   under them and the margin meter
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
// Everything below the call to positionSize() is presentation.
import { bindSliders, createResultView, initActions, parseNumber, revealAdvanced, setFlag } from '../components/calc/calc-ui';
import { updateScaleBars } from '../components/calc/scale-bars';
import { floorTo, maxLeverage } from '../lib/calc/leverage';
import { roundToTick } from '../lib/calc/liquidation';
import { positionSize } from '../lib/calc/position-size';
import type { PositionSizeIssue } from '../lib/calc/position-size';
import { fmt, formatNumber, formatPercent, tickDecimals } from '../lib/fmt';

interface CalcData {
  tick: number;
  maxLeverage: number;
  tierLimit: number;
  /** Maintenance margin rate from the risk-limit snapshot, as a fraction. */
  mmr: number;
  strings: {
    stopBar: string;
    liqBar: string;
    barLabel: string;
    levText: string;
    marginMeter: string;
    figure: string;
    long: string;
    short: string;
    liquidated: string;
    liquidatedNoFix: string;
    liqRow: string;
    usdt: string;
    marginNote: string;
    tier: string;
    invalid: string;
    noValue: string;
    errors: Record<'accountSize' | 'risk' | 'entryPrice' | 'stopPrice' | 'leverage' | 'feeRate' | 'noRoom', string>;
  };
}

const STORAGE_KEY = 'perpmath:position-size:v1';
const PARAMS = ['account', 'risk', 'entry', 'stop', 'lev', 'fee'] as const;
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
  const decimals = tickDecimals(data.tick);
  const showPrice = (n: number) => formatNumber(roundToTick(n, data.tick), decimals);
  /** A price the reader typed: keep whole numbers whole. */
  const showTyped = (n: number) => formatNumber(n, Number.isInteger(n) ? 0 : decimals);
  const money = (n: number) => formatNumber(n, 2);
  /** Quantity is cut, never rounded up, so the loss at the stop stays inside the risk. */
  const showQty = (n: number) => {
    const places = n >= 0.01 ? 4 : 6;
    return formatNumber(floorTo(n, places), places);
  };

  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
  const inputs: Record<Param, HTMLInputElement | null> = {
    account: $<HTMLInputElement>('#account'),
    risk: $<HTMLInputElement>('#risk'),
    entry: $<HTMLInputElement>('#entry'),
    stop: $<HTMLInputElement>('#stop'),
    lev: $<HTMLInputElement>('#lev'),
    fee: $<HTMLInputElement>('#fee'),
  };
  const bars = $('#calc-bars');
  const outNotional = $('#out-notional');
  const outMargin = $('#out-margin');
  const outFee = $('#out-fee');
  const outLoss = $('#out-loss');
  const outLiq = $('#out-liq');
  const outLiqLabel = $('#out-liq-label');
  const outMarginShare = $('#out-margin-share');
  const outAccount = $('#out-account');
  const meter = $('#calc-margin-meter');
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
  const fieldOf: Partial<Record<PositionSizeIssue, Param>> = {
    accountSize: 'account',
    risk: 'risk',
    entryPrice: 'entry',
    stopPrice: 'stop',
    leverage: 'lev',
    noRoom: 'lev',
    feeRate: 'fee',
  };

  function showErrors(issues: PositionSizeIssue[], leverage: number): void {
    const messages: Partial<Record<Param, string>> = {};
    for (const issue of issues) {
      const field = fieldOf[issue];
      if (!field || messages[field]) continue; // one message per field, the first one
      const template = s.errors[issue as keyof CalcData['strings']['errors']];
      if (template) messages[field] = fmt(template, { max: data.maxLeverage, lev: leverage });
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

  /** The margin as a share of the account: the meter's full width is the account. */
  function setMeter(margin: number, account: number, fits: boolean): void {
    if (!meter) return;
    const drawable = Number.isFinite(margin) && Number.isFinite(account) && account > 0;
    meter.style.setProperty('--value', drawable ? Math.min(1, Math.max(0, margin / account)).toFixed(4) : '0');
    meter.setAttribute('aria-label', drawable ? fmt(s.marginMeter, { margin: money(margin), account: money(account) }) : s.invalid);
    if (drawable && !fits) meter.dataset.tone = 'negative';
    else delete meter.dataset.tone;
  }

  function render(save: boolean): void {
    const state = readState();
    const accountSize = parseNumber(state.account);
    const riskFraction = parseNumber(state.risk) / 100;
    const entryPrice = parseNumber(state.entry);
    const stopPrice = parseNumber(state.stop);
    const leverage = parseNumber(state.lev);
    const feeRate = parseNumber(state.fee) / 100;

    const result = positionSize({
      accountSize,
      riskFraction,
      entryPrice,
      stopPrice,
      leverage,
      feeRate,
      mmr: data.mmr,
      maxLeverage: data.maxLeverage,
    });

    if (Number.isFinite(leverage) && leverage > 0) setText(outLiqLabel, fmt(s.liqRow, { lev: leverage }));

    if (!result.ok) {
      showErrors(result.issues, leverage);
      view.show({ figure: s.noValue, sentence: s.invalid, state: 'invalid' });
      updateScaleBars(
        bars!,
        { a: Number.NaN, b: Number.NaN },
        { aValue: s.noValue, bValue: s.noValue, caption: () => s.invalid },
      );
      for (const cell of [outNotional, outMargin, outFee, outLoss, outLiq, outMarginShare, outAccount]) setText(cell, s.noValue);
      setMeter(Number.NaN, Number.NaN, true);
      setFlag('calc-margin-note', null);
      setFlag('calc-tier', null);
    } else {
      showErrors([], leverage);
      const stopPct = formatPercent(result.stopDistance);
      const liqPct = formatPercent(result.liquidationDistance);
      const qty = showQty(result.quantity);
      const stopText = showTyped(stopPrice);
      const liqText = showPrice(result.liquidationPrice);

      updateScaleBars(
        bars!,
        { a: result.stopDistance, b: result.liquidationDistance },
        {
          aValue: stopPct,
          bLabel: fmt(s.liqBar, { lev: leverage }),
          bValue: liqPct,
          caption: (layout) => fmt(s.barLabel, { max: layout.maxLabel, stop: stopPct, lev: leverage, liq: liqPct }),
        },
      );

      if (result.stopBeforeLiquidation) {
        view.showText({
          text: fmt(s.figure, { qty }),
          sentence: fmt(result.side === 'long' ? s.long : s.short, {
            qty,
            stop: stopText,
            amount: money(result.riskAmount),
            pct: formatPercent(riskFraction),
            fee: money(result.roundTripFee),
          }),
          state: 'ready',
        });
      } else {
        // Say it plainly, and say which leverage would put the stop first.
        const fix = maxLeverage({ side: result.side, entryPrice, stopPrice, mmr: data.mmr, maxLeverage: data.maxLeverage });
        const vars = { lev: leverage, liq: liqText, stop: stopText };
        view.showText({
          text: fmt(s.figure, { qty }),
          sentence:
            fix.ok && fix.feasible ? fmt(s.liquidated, { ...vars, max: fix.maxWholeLeverage }) : fmt(s.liquidatedNoFix, vars),
          state: 'caution',
        });
      }

      setText(outNotional, fmt(s.usdt, { value: money(result.notional) }));
      setText(outMargin, fmt(s.usdt, { value: money(result.margin) }));
      setText(outFee, fmt(s.usdt, { value: money(result.roundTripFee) }));
      // No loss "at the stop" to report when the stop is never reached.
      setText(outLoss, result.stopBeforeLiquidation ? fmt(s.usdt, { value: money(result.lossAtStop) }) : s.noValue);
      setText(outLiq, liqText);
      setText(outMarginShare, fmt(s.usdt, { value: money(result.margin) }));
      setText(outAccount, fmt(s.usdt, { value: money(accountSize) }));
      setMeter(result.margin, accountSize, result.marginFits);

      setFlag('calc-margin-note', result.marginFits ? null : s.marginNote);
      setFlag(
        'calc-tier',
        result.notional > data.tierLimit
          ? fmt(s.tier, { value: formatNumber(result.notional), limit: formatNumber(data.tierLimit) })
          : null,
      );
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
  revealAdvanced();
  render(false);
}

init();
