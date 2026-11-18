// Liquidation price calculator, browser side.
// - reads the inputs, runs src/lib/calc/liquidation.ts, updates bar and result
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// - "Use live price" asks Bybit's public ticker endpoint for the last price
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
import { liquidationPrice, roundToTick } from '../lib/calc/liquidation';
import type { LiquidationIssue, Side } from '../lib/calc/liquidation';
import { fmt, formatNumber, formatPercent, tickDecimals } from '../lib/fmt';

interface CalcData {
  tick: number;
  maxLeverage: number;
  tierLimit: number;
  defaults: { side: Side; entry: number; lev: number; mmrPct: number };
  liveBusy: string;
  strings: {
    liquidation: string;
    entry: string;
    barLabel: string;
    long: string;
    short: string;
    unreachable: string;
    invalid: string;
    noValue: string;
    tier: string;
    liveOk: string;
    liveFail: string;
    errors: Record<Exclude<LiquidationIssue, 'side'>, string>;
  };
}

const TICKER_URL = 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT';
const STORAGE_KEY = 'perpmath:liquidation:v1';
const PARAMS = ['side', 'entry', 'lev', 'mmr', 'qty', 'extra'] as const;
type Param = (typeof PARAMS)[number];
type State = Record<Param, string>;

/** "68,000" -> 68000. Empty or unreadable text -> NaN. */
function parseNumber(text: string): number {
  const cleaned = text.replace(/[,\s]/g, '');
  if (cleaned === '') return Number.NaN;
  return Number(cleaned);
}

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

  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
  const inputs = {
    entry: $<HTMLInputElement>('#entry'),
    lev: $<HTMLInputElement>('#lev'),
    mmr: $<HTMLInputElement>('#mmr'),
    qty: $<HTMLInputElement>('#qty'),
    extra: $<HTMLInputElement>('#extra'),
  };
  const sides = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="side"]'));
  const bar = $('#calc-scale');
  const outLiq = $('#calc-liq');
  const outEntry = $('#calc-entry');
  const outFigure = $('#calc-figure');
  const outSentence = $('#calc-sentence');
  const outTier = $('#calc-tier');
  const status = $('#calc-status');
  const liveButton = $<HTMLButtonElement>('#calc-live');
  if (!inputs.entry || !inputs.lev || !inputs.mmr || !inputs.qty || !inputs.extra || !bar) return;

  // ---- state: URL first, then localStorage, then the server defaults ------
  function readState(): State {
    const side = sides.find((r) => r.checked)?.value === 'short' ? 'short' : 'long';
    return {
      side,
      entry: inputs.entry!.value.trim(),
      lev: inputs.lev!.value.trim(),
      mmr: inputs.mmr!.value.trim(),
      qty: inputs.qty!.value.trim(),
      extra: inputs.extra!.value.trim(),
    };
  }

  function applyState(state: Partial<State>): void {
    if (state.side === 'long' || state.side === 'short') {
      for (const radio of sides) radio.checked = radio.value === state.side;
    }
    if (typeof state.entry === 'string') inputs.entry!.value = state.entry;
    if (typeof state.lev === 'string') inputs.lev!.value = state.lev;
    if (typeof state.mmr === 'string') inputs.mmr!.value = state.mmr;
    if (typeof state.qty === 'string') inputs.qty!.value = state.qty;
    if (typeof state.extra === 'string') inputs.extra!.value = state.extra;
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
  const fieldOf: Record<Exclude<LiquidationIssue, 'side'>, keyof typeof inputs> = {
    entryPrice: 'entry',
    leverage: 'lev',
    noRoom: 'lev',
    mmr: 'mmr',
    extraMargin: 'extra',
    quantity: 'qty',
  };

  function showErrors(issues: LiquidationIssue[], leverage: number): void {
    const messages: Partial<Record<keyof typeof inputs, string>> = {};
    for (const issue of issues) {
      if (issue === 'side') continue;
      const field = fieldOf[issue];
      if (messages[field]) continue; // one message per field, the first one
      messages[field] = fmt(s.errors[issue], { max: data.maxLeverage, lev: leverage });
    }
    for (const key of Object.keys(inputs) as Array<keyof typeof inputs>) {
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
  function setBar(room: number, label: string): void {
    bar!.style.setProperty('--room', room.toFixed(4));
    bar!.setAttribute('aria-label', label);
  }

  function render(save: boolean): void {
    const state = readState();
    const entryPrice = parseNumber(state.entry);
    const leverage = parseNumber(state.lev);
    const mmr = parseNumber(state.mmr) / 100;
    const quantity = state.qty === '' ? undefined : parseNumber(state.qty);
    const extraMargin = state.extra === '' ? 0 : parseNumber(state.extra);

    const result = liquidationPrice({
      side: state.side as Side,
      entryPrice,
      leverage,
      mmr,
      quantity,
      extraMargin,
      maxLeverage: data.maxLeverage,
    });

    if (outEntry && Number.isFinite(entryPrice) && entryPrice > 0) {
      outEntry.textContent = fmt(s.entry, { price: formatNumber(entryPrice, Number.isInteger(entryPrice) ? 0 : decimals) });
    }

    if (!result.ok) {
      showErrors(result.issues, leverage);
      setBar(0, s.invalid);
      if (outLiq) outLiq.textContent = fmt(s.liquidation, { price: s.noValue });
      if (outFigure) outFigure.textContent = s.noValue;
      if (outSentence) outSentence.textContent = s.invalid;
      if (outTier) outTier.hidden = true;
    } else {
      showErrors([], leverage);
      const pct = formatPercent(result.distance);
      if (result.reachable) {
        const priceText = showPrice(result.liquidationPrice);
        setBar(result.room, fmt(s.barLabel, { pct }));
        if (outLiq) outLiq.textContent = fmt(s.liquidation, { price: priceText });
        if (outFigure) outFigure.textContent = priceText;
        if (outSentence) outSentence.textContent = fmt(result.side === 'long' ? s.long : s.short, { pct });
      } else {
        setBar(1, s.unreachable);
        if (outLiq) outLiq.textContent = fmt(s.liquidation, { price: s.noValue });
        if (outFigure) outFigure.textContent = s.noValue;
        if (outSentence) outSentence.textContent = s.unreachable;
      }
      if (outTier) {
        const value = quantity !== undefined && quantity > 0 ? quantity * entryPrice : 0;
        if (value > data.tierLimit) {
          outTier.textContent = fmt(s.tier, { value: formatNumber(value), limit: formatNumber(data.tierLimit) });
          outTier.hidden = false;
        } else {
          outTier.hidden = true;
        }
      }
    }

    if (save) saveState(state);
  }

  // ---- live price ----------------------------------------------------------
  async function useLivePrice(): Promise<void> {
    if (!liveButton || liveButton.disabled) return;
    const label = liveButton.textContent || '';
    liveButton.disabled = true;
    liveButton.setAttribute('aria-busy', 'true');
    liveButton.textContent = data.liveBusy;
    if (status) status.textContent = '';
    try {
      const response = await fetch(TICKER_URL, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { retCode?: number; result?: { list?: Array<{ lastPrice?: string }> } };
      const last = Number(body.result?.list?.[0]?.lastPrice);
      if (body.retCode !== 0 || !Number.isFinite(last) || last <= 0) throw new Error('No price in response');
      inputs.entry!.value = String(last);
      render(true);
      if (status) {
        status.textContent = fmt(s.liveOk, {
          price: formatNumber(last, decimals),
          time: new Date().toISOString().slice(11, 19),
        });
      }
    } catch {
      if (status) status.textContent = s.liveFail;
    } finally {
      liveButton.disabled = false;
      liveButton.removeAttribute('aria-busy');
      liveButton.textContent = label;
    }
  }

  form.addEventListener('input', () => render(true));
  form.addEventListener('change', () => render(true));
  form.addEventListener('submit', (event) => event.preventDefault());
  liveButton?.addEventListener('click', () => void useLivePrice());

  loadState();
  render(false);
}

init();
