// "Fetch current values from Bybit" on the data pages (funding rate, open
// interest, long/short ratio). Markup: src/components/market/LivePanel.astro.
//
// The page is complete without this script: it shows the report-day figures
// rendered at build time, and the live block is hidden in the HTML. This
// script shows the block; a click asks Bybit's public API for the current
// value of each contract and prints it in the block's own table, next to the
// word "Live" and the time of the fetch. The report-day table is never
// touched.
//
// The block is in one of five states (data-state on its root):
//   idle     only the introduction and the button
//   loading  placeholders the size of the rows to come
//   ready    the values, with the fetch time
//   empty    Bybit answered, but with no row for any of the contracts
//   error    a request failed (network, timeout, HTTP error, Bybit error
//            code, a field that is not a number). Nothing is shown in place
//            of the missing values; the block says so and offers a retry.
// A failure is all or nothing: one failed request puts the block in "error".
//
// Imports only dependency-free modules; strings arrive as JSON in data-live.
import { fmt, formatNumber, formatPercent } from '../lib/fmt';
import { ratePercent } from '../lib/market/view';

type Kind = 'funding' | 'oi' | 'ratio';
type State = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface LiveData {
  kind: Kind;
  symbols: Array<{ symbol: string; unit: string }>;
  strings: { button: string; again: string; busy: string; ok: string; cell: string; rowEmpty: string };
}

const API = 'https://api.bybit.com/v5/market';

/** First row of `result.list`. null when Bybit answers correctly with an empty list. */
async function firstRow(url: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as { retCode?: number; result?: { list?: unknown } };
  const list = body.result?.list;
  if (body.retCode !== 0 || !Array.isArray(list)) throw new Error('Unexpected response');
  if (list.length === 0) return null;
  const row = list[0];
  if (!row || typeof row !== 'object') throw new Error('Unexpected response');
  return row as Record<string, unknown>;
}

function positive(value: unknown): number {
  const n = Number(value);
  if (value === '' || value === null || !Number.isFinite(n) || n <= 0) throw new Error('Bad number in response');
  return n;
}

function finite(value: unknown): number {
  const n = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(n)) throw new Error('Bad number in response');
  return n;
}

/** The formatted current value of one contract, or null when Bybit has no row for it. */
async function currentValue(kind: Kind, symbol: string, unit: string, template: string): Promise<string | null> {
  const q = `category=linear&symbol=${encodeURIComponent(symbol)}`;
  if (kind === 'ratio') {
    const row = await firstRow(`${API}/account-ratio?${q}&period=5min&limit=1`);
    if (!row) return null;
    const long = positive(row.buyRatio);
    const short = positive(row.sellRatio);
    return fmt(template, { long: formatPercent(long), ratio: formatNumber(long / short, 2) });
  }
  const row = await firstRow(`${API}/tickers?${q}`);
  if (!row) return null;
  if (kind === 'oi') {
    return fmt(template, { value: formatNumber(positive(row.openInterest)), unit });
  }
  const settles = new Date(positive(row.nextFundingTime)).toISOString().slice(11, 16);
  return fmt(template, { rate: ratePercent(finite(row.fundingRate)), time: settles });
}

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-live]');
  const button = root?.querySelector<HTMLButtonElement>('[data-live-button]');
  const status = root?.querySelector<HTMLElement>('[data-live-status]');
  if (!root || !button || !status) return;

  let data: LiveData;
  try {
    data = JSON.parse(root.dataset.live || '') as LiveData;
  } catch {
    return; // the block stays hidden; the build-time table is all there is
  }

  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-live-block]'));
  const cells = new Map<string, HTMLElement>();
  for (const cell of Array.from(root.querySelectorAll<HTMLElement>('[data-live-value]'))) {
    cells.set(cell.dataset.liveValue || '', cell);
  }
  // The button holds an icon and then its label: change the label only.
  const label = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  const setLabel = (text: string) => {
    if (label) label.textContent = text;
    else button.append(text);
  };

  const show = (state: State) => {
    root.dataset.state = state;
    for (const block of blocks) block.hidden = block.dataset.liveBlock !== state;
  };

  // While a fetch runs the button is marked busy, not disabled, so that it
  // can keep (or take) the keyboard focus.
  let busy = false;

  async function refresh(): Promise<void> {
    if (busy) return;
    busy = true;
    button!.setAttribute('aria-disabled', 'true');
    button!.setAttribute('aria-busy', 'true');
    setLabel(data.strings.busy);
    status!.textContent = '';
    show('loading');
    let next: State = 'error';
    try {
      const values = await Promise.all(
        data.symbols.map(({ symbol, unit }) => currentValue(data.kind, symbol, unit, data.strings.cell)),
      );
      if (values.every((value) => value === null)) {
        next = 'empty';
      } else {
        data.symbols.forEach(({ symbol }, i) => {
          const cell = cells.get(symbol);
          if (cell) cell.textContent = values[i] ?? data.strings.rowEmpty;
        });
        // "2026-11-19 08:52:03": the reader's clock, printed in UTC.
        const now = new Date().toISOString();
        status!.textContent = fmt(data.strings.ok, { time: `${now.slice(0, 10)} ${now.slice(11, 19)}` });
        next = 'ready';
      }
    } catch {
      // Old values must not stay on screen next to an error.
      for (const cell of cells.values()) cell.textContent = '';
      next = 'error';
    } finally {
      busy = false;
      button!.removeAttribute('aria-disabled');
      button!.removeAttribute('aria-busy');
      setLabel(next === 'ready' ? data.strings.again : data.strings.button);
      show(next);
    }
  }

  button.addEventListener('click', () => void refresh());
  root.querySelector<HTMLButtonElement>('[data-live-retry]')?.addEventListener('click', () => {
    // The retry button is about to be hidden with its block.
    button.focus();
    void refresh();
  });
  show('idle');
  root.hidden = false;
}

init();
