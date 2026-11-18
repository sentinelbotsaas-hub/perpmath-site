// "Fetch current values from Bybit" on the data pages (funding rate, open
// interest, long/short ratio).
//
// The page is complete without this script: it shows the report-day figures
// rendered at build time. The button is hidden in the HTML and only appears
// when this script runs. A click asks Bybit's public API for the current
// value of each contract and shows it in an extra "Now" column.
//
// Failure is all or nothing and always visible: if any of the requests fails
// (network, timeout, HTTP error, Bybit error code, missing field), the "Now"
// column is hidden again and the status line under the table says that
// Bybit could not be reached and that the table still shows the report day.
//
// Imports only dependency-free modules; strings arrive as JSON in data-live.
import { fmt, formatNumber, formatPercent } from '../lib/fmt';
import { ratePercent } from '../lib/market/view';

type Kind = 'funding' | 'oi' | 'ratio';

interface LiveData {
  kind: Kind;
  /** Report day, for the failure message. */
  date: string;
  symbols: Array<{ symbol: string; unit: string }>;
  strings: { busy: string; ok: string; fail: string; cell: string };
}

const API = 'https://api.bybit.com/v5/market';

/** First row of `result.list`, or an error. */
async function firstRow(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as { retCode?: number; result?: { list?: unknown[] } };
  const row = body.result?.list?.[0];
  if (body.retCode !== 0 || !row || typeof row !== 'object') throw new Error('No data in response');
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

async function currentValue(kind: Kind, symbol: string, unit: string, template: string): Promise<string> {
  const q = `category=linear&symbol=${encodeURIComponent(symbol)}`;
  if (kind === 'ratio') {
    const row = await firstRow(`${API}/account-ratio?${q}&period=5min&limit=1`);
    const long = positive(row.buyRatio);
    const short = positive(row.sellRatio);
    return fmt(template, { long: formatPercent(long), ratio: formatNumber(long / short, 2) });
  }
  const row = await firstRow(`${API}/tickers?${q}`);
  if (kind === 'oi') {
    return fmt(template, { value: formatNumber(positive(row.openInterest)), unit });
  }
  const settles = new Date(positive(row.nextFundingTime)).toISOString().slice(11, 16);
  return fmt(template, { rate: ratePercent(finite(row.fundingRate)), time: settles });
}

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-live]');
  const button = document.querySelector<HTMLButtonElement>('#live-button');
  const status = document.querySelector<HTMLElement>('#live-status');
  if (!root || !button || !status) return;

  let data: LiveData;
  try {
    data = JSON.parse(root.dataset.live || '') as LiveData;
  } catch {
    return; // no button, the build-time table stays as it is
  }

  const heads = Array.from(root.querySelectorAll<HTMLElement>('[data-live-head]'));
  const cells = new Map<string, HTMLElement>();
  for (const cell of Array.from(root.querySelectorAll<HTMLElement>('[data-live-cell]'))) {
    cells.set(cell.dataset.liveCell || '', cell);
  }
  const showColumn = (visible: boolean) => {
    for (const el of [...heads, ...cells.values()]) el.hidden = !visible;
  };

  async function refresh(): Promise<void> {
    if (button!.disabled) return;
    const label = button!.textContent || '';
    button!.disabled = true;
    button!.setAttribute('aria-busy', 'true');
    button!.textContent = data.strings.busy;
    status!.textContent = '';
    try {
      const values = await Promise.all(
        data.symbols.map(({ symbol, unit }) => currentValue(data.kind, symbol, unit, data.strings.cell)),
      );
      data.symbols.forEach(({ symbol }, i) => {
        const cell = cells.get(symbol);
        const target = cell?.querySelector<HTMLElement>('[data-live-value]') ?? cell;
        if (target) target.textContent = values[i];
      });
      showColumn(true);
      status!.textContent = fmt(data.strings.ok, { time: new Date().toISOString().slice(11, 19) });
    } catch {
      showColumn(false);
      status!.textContent = fmt(data.strings.fail, { date: data.date });
    } finally {
      button!.disabled = false;
      button!.removeAttribute('aria-busy');
      button!.textContent = label;
    }
  }

  button.addEventListener('click', () => void refresh());
  button.hidden = false;
}

init();
