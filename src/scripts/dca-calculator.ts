// DCA calculator, browser side.
// - reads the fills and the settings, runs src/lib/calc/dca.ts, updates the
//   result panel, the bars (each fill's share of the quantity) and the table
// - adds and removes fills; every control is a real button or input, so the
//   keyboard reaches all of it, and focus is put where the reader continues
// - state lives in the URL query (shareable) and in localStorage (try/catch)
// Imports only dependency-free modules; strings arrive as JSON in data-calc.
// Everything below the call to dca() is presentation (dca-view.ts).
import { bindSliders, createResultView, initActions, parseNumber, setFlag } from '../components/calc/calc-ui';
import { dcaFormat, dcaView } from '../components/calc/dca-view';
import type { DcaMode, DcaViewStrings } from '../components/calc/dca-view';
import { updateFillsBars } from '../components/calc/fills-bars';
import { setToned } from '../components/calc/signed';
import { dca } from '../lib/calc/dca';
import type { DcaIssue, DcaRowIssue, DcaSizeUnit } from '../lib/calc/dca';
import type { Side } from '../lib/calc/liquidation';
import { fmt, formatNumber } from '../lib/fmt';

interface FillState {
  price: string;
  size: string;
}

interface CalcData {
  tick: number;
  maxLeverage: number;
  tierLimit: number;
  /** Maintenance margin rate from the risk-limit snapshot, as a fraction. */
  mmr: number;
  maxFills: number;
  defaults: { mode: string; unit: string; side: Side; lev: number; fills: Array<{ price: number; size: number }> };
  strings: DcaViewStrings & {
    levText: string;
    removeLabel: string;
    quantity: string;
    amount: string;
    tier: string;
    added: string;
    removed: string;
    full: string;
    invalid: string;
    errors: Record<'price' | 'size' | 'leverage' | 'noRoom', string>;
  };
}

interface State {
  mode: DcaMode;
  unit: DcaSizeUnit;
  side: Side;
  lev: string;
  fills: FillState[];
}

const STORAGE_KEY = 'perpmath:dca:v1';
const MAX_TEXT = 24;

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
  const rowsBox = $('#dca-rows');
  const addButton = $<HTMLButtonElement>('#dca-add');
  const status = $('#dca-status');
  const lev = $<HTMLInputElement>('#lev');
  const bars = $('#calc-fills');
  const label = $('#calc-label');
  const peekLabel = $('.calc-peek-label');
  const radios = (name: string) => Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));
  const modes = radios('mode');
  const units = radios('unit');
  const sides = radios('side');
  const groups = Array.from(document.querySelectorAll<HTMLElement>('.calc-shell [data-mode]'));
  if (!rowsBox || !addButton || !lev || !bars) return;

  const view = createResultView();
  const syncSliders = bindSliders(form);
  const say = (text: string) => {
    if (status) status.textContent = text;
  };

  // ---- the rows ------------------------------------------------------------
  const rowsOf = () => Array.from(rowsBox.querySelectorAll<HTMLElement>('[data-fill]'));
  const priceOf = (row: HTMLElement) => row.querySelector<HTMLInputElement>('[data-fill-price]')!;
  const sizeOf = (row: HTMLElement) => row.querySelector<HTMLInputElement>('[data-fill-size]')!;
  const removeOf = (row: HTMLElement) => row.querySelector<HTMLButtonElement>('[data-fill-remove]');
  const checked = (list: HTMLInputElement[], fallback: string) => list.find((r) => r.checked)?.value ?? fallback;
  const currentMode = (): DcaMode => (checked(modes, 'futures') === 'spot' ? 'spot' : 'futures');
  const currentUnit = (): DcaSizeUnit => (checked(units, 'quantity') === 'amount' ? 'amount' : 'quantity');
  const currentSide = (): Side => (checked(sides, 'long') === 'short' ? 'short' : 'long');

  /** Number the rows 1, 2, 3 again: ids, labels, the name of each remove button. */
  function renumber(): void {
    const rows = rowsOf();
    const mode = currentMode();
    const unit = currentUnit();
    const sizeLabel = unit === 'amount' ? s.amount : s.quantity;
    const sizeUnit = unit === 'amount' ? 'USDT' : mode === 'futures' ? s.coin : s.coinSpot;
    rows.forEach((row, i) => {
      const n = i + 1;
      const title = row.querySelector<HTMLElement>('[data-fill-title]');
      if (title) {
        title.id = `fill-${n}-title`;
        title.textContent = fmt(s.fill, { n });
      }
      row.setAttribute('aria-labelledby', `fill-${n}-title`);
      for (const [input, key] of [
        [priceOf(row), 'price'],
        [sizeOf(row), 'size'],
      ] as Array<[HTMLInputElement, string]>) {
        const field = input.closest('.field');
        input.id = `${key}-${n}`;
        input.setAttribute('aria-describedby', `${key}-${n}-error`);
        field?.querySelector('label')?.setAttribute('for', `${key}-${n}`);
        const error = field?.querySelector<HTMLElement>('.field-error');
        if (error) error.id = `${key}-${n}-error`;
      }
      const sizeLabelEl = row.querySelector<HTMLElement>('[data-fill-size-label]');
      if (sizeLabelEl && sizeLabelEl.textContent !== sizeLabel) sizeLabelEl.textContent = sizeLabel;
      const sizeUnitEl = row.querySelector<HTMLElement>('[data-fill-size-unit]');
      if (sizeUnitEl && sizeUnitEl.textContent !== sizeUnit) sizeUnitEl.textContent = sizeUnit;
      const remove = removeOf(row);
      if (remove) {
        remove.setAttribute('aria-label', fmt(s.removeLabel, { n }));
        remove.disabled = rows.length === 1; // the last fill stays
      }
    });
    addButton!.disabled = rows.length >= data.maxFills;
  }

  /** A new row is a copy of the first one, emptied. */
  function makeRow(fill: FillState): HTMLElement {
    const row = rowsOf()[0].cloneNode(true) as HTMLElement;
    for (const input of [priceOf(row), sizeOf(row)]) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('value'); // a later form.reset() must not bring the copied value back
    }
    for (const error of Array.from(row.querySelectorAll<HTMLElement>('.field-error'))) {
      error.textContent = '';
      error.hidden = true;
    }
    priceOf(row).value = fill.price;
    sizeOf(row).value = fill.size;
    return row;
  }

  /** Make the list hold exactly these fills. */
  function setRows(fills: FillState[]): void {
    const wanted = fills.slice(0, data.maxFills);
    if (wanted.length === 0) return;
    let rows = rowsOf();
    while (rows.length > wanted.length) {
      rows[rows.length - 1].remove();
      rows = rowsOf();
    }
    while (rows.length < wanted.length) {
      rowsBox!.appendChild(makeRow({ price: '', size: '' }));
      rows = rowsOf();
    }
    rows.forEach((row, i) => {
      priceOf(row).value = wanted[i].price;
      sizeOf(row).value = wanted[i].size;
    });
    renumber();
  }

  function addRow(): void {
    const rows = rowsOf();
    if (rows.length >= data.maxFills) {
      say(fmt(s.full, { max: data.maxFills }));
      return;
    }
    const row = makeRow({ price: '', size: '' });
    rowsBox!.appendChild(row);
    renumber();
    render(true);
    say(fmt(s.added, { n: rows.length + 1 }));
    priceOf(row).focus();
  }

  function removeRow(row: HTMLElement): void {
    const rows = rowsOf();
    if (rows.length <= 1) return;
    const index = rows.indexOf(row);
    row.remove();
    renumber();
    render(true);
    const left = rowsOf();
    say(fmt(s.removed, { n: index + 1, left: left.length }));
    // Focus goes to the same place in the list, so several can be removed in a row.
    const next = removeOf(left[Math.min(index, left.length - 1)]);
    if (next && !next.disabled) next.focus();
    else addButton!.focus();
  }

  // ---- state: URL first, then localStorage, then the server defaults ------
  function readState(): State {
    return {
      mode: currentMode(),
      unit: currentUnit(),
      side: currentSide(),
      lev: lev!.value.trim(),
      fills: rowsOf().map((row) => ({ price: priceOf(row).value.trim(), size: sizeOf(row).value.trim() })),
    };
  }

  function applyState(state: Partial<State>): void {
    const set = (list: HTMLInputElement[], value: unknown) => {
      if (typeof value === 'string' && list.some((r) => r.value === value)) for (const r of list) r.checked = r.value === value;
    };
    set(modes, state.mode);
    set(units, state.unit);
    set(sides, state.side);
    if (typeof state.lev === 'string') lev!.value = state.lev.slice(0, MAX_TEXT);
    if (Array.isArray(state.fills)) {
      setRows(
        state.fills
          .filter((fill) => fill && typeof fill.price === 'string' && typeof fill.size === 'string')
          .map((fill) => ({ price: fill.price.slice(0, MAX_TEXT), size: fill.size.slice(0, MAX_TEXT) })),
      );
    }
  }

  function loadState(): void {
    const query = new URLSearchParams(window.location.search);
    const fromUrl: Partial<State> = {};
    const mode = query.get('mode');
    const unit = query.get('unit');
    const side = query.get('side');
    const levText = query.get('lev');
    const prices = query.getAll('price');
    const sizes = query.getAll('size');
    if (mode !== null) fromUrl.mode = mode as DcaMode;
    if (unit !== null) fromUrl.unit = unit as DcaSizeUnit;
    if (side !== null) fromUrl.side = side as Side;
    if (levText !== null) fromUrl.lev = levText;
    if (prices.length > 0 || sizes.length > 0) {
      const count = Math.max(prices.length, sizes.length);
      fromUrl.fills = Array.from({ length: count }, (_, i) => ({ price: prices[i] ?? '', size: sizes[i] ?? '' }));
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
    query.set('mode', state.mode);
    query.set('unit', state.unit);
    // Only the settings of the chosen mode go into the link.
    if (state.mode === 'futures') {
      query.set('side', state.side);
      if (state.lev !== '') query.set('lev', state.lev);
    }
    for (const fill of state.fills) {
      query.append('price', fill.price);
      query.append('size', fill.size);
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
  function mark(input: HTMLInputElement, message: string | undefined): void {
    const line = document.getElementById(`${input.id}-error`);
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

  function showErrors(issues: DcaIssue[], rowIssues: DcaRowIssue[], leverage: number): void {
    const levMessage = issues.includes('leverage')
      ? fmt(s.errors.leverage, { max: data.maxLeverage })
      : issues.includes('noRoom')
        ? fmt(s.errors.noRoom, { lev: leverage })
        : undefined;
    mark(lev!, levMessage);
    rowsOf().forEach((row, i) => {
      const bad = (field: 'price' | 'size') => rowIssues.some((issue) => issue.row === i && issue.field === field);
      mark(priceOf(row), bad('price') ? s.errors.price : undefined);
      mark(sizeOf(row), bad('size') ? s.errors.size : undefined);
    });
  }

  // ---- render --------------------------------------------------------------
  function setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function render(save: boolean): void {
    const state = readState();
    const mode = state.mode;
    for (const group of groups) group.hidden = group.dataset.mode !== mode;
    renumber(); // the size label and unit follow the mode and the unit

    const leverage = parseNumber(state.lev);
    const result = dca({
      fills: state.fills.map((fill) => ({ price: parseNumber(fill.price), size: parseNumber(fill.size) })),
      sizeUnit: state.unit,
      futures: mode === 'futures' ? { side: state.side, leverage, mmr: data.mmr, maxLeverage: data.maxLeverage } : undefined,
    });
    const labelText = mode === 'futures' ? s.labelFutures : s.labelSpot;
    if (label && label.textContent !== labelText) label.textContent = labelText;
    // The strip on phones repeats the figure, so it repeats its name too.
    if (peekLabel && peekLabel.textContent !== labelText) peekLabel.textContent = labelText;
    // The row names the leverage; only a usable one is repeated there.
    if (leverage >= 1 && leverage <= data.maxLeverage) setText('out-fresh-label', fmt(s.freshRow, { lev: leverage }));

    if (!result.ok) {
      showErrors(result.issues, result.rowIssues, leverage);
      view.show({ figure: s.noValue, sentence: s.invalid, state: 'invalid' });
      updateFillsBars(
        bars!,
        state.fills.map((fill, i) => {
          // Only a usable price is repeated next to its bar; anything else is "no value".
          const typed = parseNumber(fill.price);
          const price = Number.isFinite(typed) && typed > 0 ? dcaFormat(mode, data.tick).typed(typed) : s.noValue;
          return { name: fmt(s.fill, { n: i + 1 }), price, value: s.noValue, share: 0 };
        }),
        s.invalid,
        false,
      );
      for (const id of ['out-quantity', 'out-cost', 'out-multiple', 'out-margin', 'out-first-liq', 'out-liq', 'out-room', 'out-fresh']) {
        setText(id, s.noValue);
      }
      for (const id of ['out-vs-first', 'out-unrealized', 'out-to-average']) setToned(document.getElementById(id), s.noValue, undefined);
      setFlag('calc-tier', null);
    } else {
      showErrors([], [], leverage);
      const v = dcaView(result, mode, data.tick, s);
      if (v.state === 'caution') view.show({ figure: v.figure, sentence: v.sentence, state: 'caution' });
      else view.showText({ text: v.figure, sentence: v.sentence, state: 'ready' });
      updateFillsBars(bars!, v.bars, v.caption, v.barsReady);
      setText('out-quantity', v.quantity);
      setText('out-cost', v.cost);
      setToned(document.getElementById('out-vs-first'), v.vsFirst.text, v.vsFirst.tone);
      setText('out-multiple', v.multiple);
      setToned(document.getElementById('out-unrealized'), v.unrealized.text, v.unrealized.tone);
      setToned(document.getElementById('out-to-average'), v.toAverage.text, v.toAverage.tone);
      setText('out-margin', v.margin);
      setText('out-first-liq', v.firstLiq);
      setText('out-liq', v.liq);
      setText('out-room', v.room);
      setText('out-fresh', v.fresh);
      setFlag(
        'calc-tier',
        mode === 'futures' && result.totalCost > data.tierLimit
          ? fmt(s.tier, { value: formatNumber(result.totalCost), limit: formatNumber(data.tierLimit) })
          : null,
      );
    }

    if (save) saveState(state);
  }

  form.addEventListener('input', () => render(true));
  form.addEventListener('change', () => render(true));
  form.addEventListener('submit', (event) => event.preventDefault());
  addButton.addEventListener('click', addRow);
  rowsBox.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-fill-remove]');
    const row = button?.closest<HTMLElement>('[data-fill]');
    if (button && row && !button.disabled) removeRow(row);
  });

  initActions({
    view,
    storageKey: STORAGE_KEY,
    save: () => saveState(readState()),
    reset: () => {
      form.reset();
      setRows(data.defaults.fills.map((fill) => ({ price: String(fill.price), size: String(fill.size) })));
      syncSliders();
      say('');
      render(false);
    },
  });

  loadState();
  syncSliders();
  render(false);
}

init();
