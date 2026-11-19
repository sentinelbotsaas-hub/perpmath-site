// When does a report stop being "the latest"? Shared by StaleNotice.astro and
// the pages that pass `stale` to <DataFreshness>.
//
// The report for UTC day D is built during day D+1 and the next one during
// D+2. Once D+2 is over and the page still shows D, a report is missing.
import { DAY_MS, utcDayStart } from '../../lib/market/compute';

/** Unix milliseconds after which a report for `reportDate` cannot be the latest one. */
export function staleAfter(reportDate: string): number {
  return utcDayStart(reportDate) + 3 * DAY_MS;
}

/** True when `now` is past that moment. */
export function isStale(reportDate: string, now: number): boolean {
  return now >= staleAfter(reportDate);
}
