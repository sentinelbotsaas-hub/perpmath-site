// The one-sentence summary of all published backtests, and the line about
// costs that goes with it. /backtests/ and the home page preview print the
// same sentence, so both get it from here; /bot/ uses the same rule
// (`code`) with its own wording.
//
// Build-time only. Which sentence is used is decided by
// src/lib/backtests/overview.ts from the result files; the counts and the
// two returns in it are filled in from the same files.
import { formatCount, formatPlusPct } from '../../lib/backtests/format';
import { gridResults, results } from '../../lib/backtests/load';
import { hasHindsightBounds, overviewOf } from '../../lib/backtests/overview';
import type { OverviewCode } from '../../lib/backtests/overview';
import { fmt } from '../../lib/fmt';

/** The strings this needs, from `backtests[locale].index`. */
export interface HeadlineStrings {
  headAllLost: string;
  head: string;
  headRanged: string;
  sub: string;
  subRanged: string;
  caption: string;
  captionPlain: string;
  captionMixed: string;
}

export interface Headline {
  code: OverviewCode;
  /** Counts as printed: every result, the signal strategies, the grids. */
  n: string;
  s: string;
  g: string;
  head: string;
  /** The line under the headline on /backtests/. */
  sub: string;
  /** Which costs the figures include, across every result. */
  caption: string;
  /** The same, for the signal strategies alone. */
  strategyCaption: string;
}

export function headline(x: HeadlineStrings, na: string): Headline {
  const code = overviewOf(results, gridResults);
  const n = formatCount(results.length + gridResults.length);
  const s = formatCount(results.length);
  const g = formatCount(gridResults.length);

  const strategiesFunded = results.some((r) => r.costs.funding_modelled);
  const gridsFunded = gridResults.some((r) => r.costs.funding_modelled);
  const strategyCaption = strategiesFunded ? x.captionPlain : x.caption;
  // "Funding is counted for the grid only" is true only when exactly that holds.
  const caption =
    gridResults.length === 0
      ? strategyCaption
      : !strategiesFunded && gridResults.every((r) => r.costs.funding_modelled)
        ? x.captionMixed
        : strategiesFunded || gridsFunded
          ? x.captionPlain
          : x.caption;

  if (code === 'grid-ranged') {
    const grid = gridResults[0];
    const vars = {
      n,
      s,
      g,
      is: formatPlusPct(grid.in_sample.metrics.total_return_pct) ?? na,
      oos: formatPlusPct(grid.out_of_sample.metrics.total_return_pct) ?? na,
    };
    return {
      code,
      n,
      s,
      g,
      head: fmt(x.headRanged, vars),
      // The longer line names the hindsight bounds; without them the plain one is the true one.
      sub: hasHindsightBounds(grid) ? fmt(x.subRanged, vars) : x.sub,
      caption,
      strategyCaption,
    };
  }
  return {
    code,
    n,
    s,
    g,
    head: fmt(code === 'all-lost' ? x.headAllLost : x.head, { n }),
    sub: x.sub,
    caption,
    strategyCaption,
  };
}
