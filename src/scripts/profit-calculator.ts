// Futures profit calculator, browser side.
// - reads the inputs, runs src/lib/calc/profit.ts, updates the result panel,
//   the two bars (P&L before costs, fees and funding) and the table
// - shows the size field of the chosen unit only (a quantity, or a margin)
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
// Everything below the call to profit() is presentation (profit-view.ts).
import { bindSliders, createResultView, initActions, parseNumber, revealAdvanced, setFlag } from '../components/calc/calc-ui';
import { profitView } from '../components/calc/profit-view';
import type { ProfitViewStrings } from '../components/calc/profit-view';
import { updateScaleBars } from '../components/calc/scale-bars';
import { setToned } from '../components/calc/signed';
import type { SignTone } from '../components/calc/signed';
import type { Side } from '../lib/calc/liquidation';
import { profit } from '../lib/calc/profit';
import type { ProfitIssue, ProfitSizeUnit } from '../lib/calc/profit';
import { fmt, formatNumber } from '../lib/fmt';

interface CalcData {
  tick: number;
  maxLeverage: number;
  tierLimit: number;
  /** Maintenance margin rate from the risk-limit snapshot, as a fraction. */
  mmr: number;
  maxPeriods: number;
  strings: ProfitViewStrings & {
    levText: string;
    tier: string;
    invalid: string;
    errors: Record<
      'entryPrice' | 'exitPrice' | 'quantity' | 'margin' | 'leverage' | 'feeRate' | 'fundingRate' | 'fundingPeriods' | 'noRoom',
      string
    >;
  };
}

const STORAGE_KEY = 'perpmath:profit:v1';
const FIELDS = ['entry', 'exit', 'qty', 'margin', 'lev', 'funding', 'periods', 'fee'] as const;
type FieldKey = (typeof FIELDS)[number];
const PARAMS = ['side', 'unit', ...FIELDS] as const;
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
  const inputs = Object.fromEntries(FIELDS.map((key) => [key, $<HTMLInputElement>(`#${key}`)])) as Record<
    FieldKey,
    HTMLInputElement | null
  >;
  const sides = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="side"]'));
  const units = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="unit"]'));
  const groups = Array.from(form.querySelectorAll<HTMLElement>('[data-unit]'));
  const bars = $('#calc-bars');
  const figure = $('#calc-figure');
  if (FIELDS.some((key) => !inputs[key]) || !bars) return;

  const view = createResultView();
  const syncSliders = bindSliders(form);
  // From here on the figure's own data-tone says which colour it takes.
  if (figure) figure.dataset.live = '';

  // ---- state: URL first, then localStorage, then the server defaults ------
  const currentSide = (): Side => (sides.find((r) => r.checked)?.value === 'short' ? 'short' : 'long');
  const currentUnit = (): ProfitSizeUnit => (units.find((r) => r.checked)?.value === 'margin' ? 'margin' : 'quantity');

  function readState(): State {
    const state = { side: currentSide(), unit: currentUnit() } as State;
    for (const key of FIELDS) state[key] = inputs[key]!.value.trim();
    return state;
  }

  function applyState(state: Partial<State>): void {
    if (state.side === 'long' || state.side === 'short') for (const r of sides) r.checked = r.value === state.side;
    if (state.unit === 'quantity' || state.unit === 'margin') for (const r of units) r.checked = r.value === state.unit;
    for (const key of FIELDS) {
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
      // A link with only a margin in it means the margin unit.
      if (!fromUrl.unit && fromUrl.qty === undefined && fromUrl.margin !== undefined) fromUrl.unit = 'margin';
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
    // Only the size field of the chosen unit goes into the link.
    const skip: Param = state.unit === 'margin' ? 'qty' : 'margin';
    const query = new URLSearchParams();
    for (const key of PARAMS) {
      if (key !== skip && state[key] !== '') query.set(key, state[key]);
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
  function showErrors(issues: ProfitIssue[], unit: ProfitSizeUnit, leverage: number): void {
    const sizeField: FieldKey = unit === 'margin' ? 'margin' : 'qty';
    const fieldOf: Partial<Record<ProfitIssue, FieldKey>> = {
      entryPrice: 'entry',
      exitPrice: 'exit',
      size: sizeField,
      leverage: 'lev',
      noRoom: 'lev',
      feeRate: 'fee',
      fundingRate: 'funding',
      fundingPeriods: 'periods',
    };
    const messages: Partial<Record<FieldKey, string>> = {};
    for (const issue of issues) {
      const field = fieldOf[issue];
      if (!field || messages[field]) continue; // one message per field, the first one
      const template = issue === 'size' ? s.errors[unit === 'margin' ? 'margin' : 'quantity'] : s.errors[issue as keyof typeof s.errors];
      if (template) messages[field] = fmt(template, { max: data.maxLeverage, lev: leverage, maxPeriods: formatNumber(data.maxPeriods) });
    }
    for (const key of FIELDS) {
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
  const cell = (id: string) => document.getElementById(id);
  function setText(id: string, text: string): void {
    const el = cell(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function setBarTones(a: SignTone | undefined, b: SignTone | undefined): void {
    const rows = Array.from(bars!.querySelectorAll<HTMLElement>('.calc-bar'));
    [a, b].forEach((tone, i) => {
      const row = rows[i];
      if (!row) return;
      if (tone) row.dataset.tone = tone;
      else delete row.dataset.tone;
    });
  }

  function setFigureTone(tone: SignTone | undefined): void {
    if (!figure) return;
    if (tone) figure.dataset.tone = tone;
    else delete figure.dataset.tone;
  }

  function render(save: boolean): void {
    const state = readState();
    const unit = state.unit as ProfitSizeUnit;
    for (const group of groups) group.hidden = group.dataset.unit !== unit;

    const entryPrice = parseNumber(state.entry);
    const exitPrice = parseNumber(state.exit);
    const leverage = parseNumber(state.lev);

    const result = profit({
      side: state.side as Side,
      entryPrice,
      exitPrice,
      sizeUnit: unit,
      size: parseNumber(unit === 'margin' ? state.margin : state.qty),
      leverage,
      feeRate: parseNumber(state.fee) / 100,
      // Funding is optional: an empty field is "none".
      fundingRate: state.funding === '' ? 0 : parseNumber(state.funding) / 100,
      fundingPeriods: state.periods === '' ? 0 : parseNumber(state.periods),
      mmr: data.mmr,
      maxLeverage: data.maxLeverage,
    });

    // The row names the leverage; only a usable one is repeated there.
    if (leverage >= 1 && leverage <= data.maxLeverage) setText('out-liq-label', fmt(s.liqRow, { lev: leverage }));

    if (!result.ok) {
      showErrors(result.issues, unit, leverage);
      view.show({ figure: s.noValue, sentence: s.invalid, state: 'invalid' });
      setFigureTone(undefined);
      updateScaleBars(bars!, { a: Number.NaN, b: Number.NaN }, { aValue: s.noValue, bValue: s.noValue, caption: () => s.invalid });
      setBarTones(undefined, undefined);
      for (const id of ['out-gross', 'out-fee', 'out-funding', 'out-roi-margin', 'out-roi-notional']) setToned(cell(id), s.noValue, undefined);
      for (const id of ['out-break-even', 'out-quantity', 'out-notional', 'out-margin', 'out-liq']) setText(id, s.noValue);
      setFlag('calc-tier', null);
    } else {
      showErrors([], unit, leverage);
      const v = profitView(result, { entry: entryPrice, exit: exitPrice, leverage, tick: data.tick }, s);
      if (v.state === 'caution') view.show({ figure: v.figure, sentence: v.sentence, state: 'caution' });
      else view.showText({ text: v.figure, sentence: v.sentence, state: 'ready' });
      setFigureTone(v.figureTone);
      updateScaleBars(bars!, { a: v.bars.a, b: v.bars.b }, { aValue: v.bars.aValue, bValue: v.bars.bValue, caption: v.bars.caption });
      setBarTones(v.bars.aTone, v.bars.bTone);
      setToned(cell('out-gross'), v.gross.text, v.gross.tone);
      setToned(cell('out-fee'), v.fee.text, v.fee.tone);
      setToned(cell('out-funding'), v.funding.text, v.funding.tone);
      setToned(cell('out-roi-margin'), v.roiMargin.text, v.roiMargin.tone);
      setToned(cell('out-roi-notional'), v.roiNotional.text, v.roiNotional.tone);
      setText('out-break-even', v.breakEven);
      setText('out-quantity', v.quantity);
      setText('out-notional', v.notional);
      setText('out-margin', v.margin);
      setText('out-liq', v.liq);
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
