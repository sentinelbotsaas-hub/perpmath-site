// What the tool directory and the "related calculators" block need to know
// about a calculator beyond its name: its icon and the group it belongs to.
// Build-time only.
//
// A group name has to describe the tools that are really in it. Add a group
// (and its strings in src/i18n/tools.ts) only when a calculator for it exists.
import type { ToolSlug } from '../../i18n/tool-index';
import type { IconName } from '../ui/Icon.astro';

export type ToolGroup = 'risk' | 'planning' | 'edge';

/** Order of the groups on /tools/. */
export const TOOL_GROUPS: ToolGroup[] = ['risk', 'planning', 'edge'];

export const TOOL_ICON: Record<ToolSlug, IconName> = {
  'liquidation-price-calculator': 'ruler',
  'leverage-calculator': 'gauge',
  'position-size-calculator': 'scale',
  'drawdown-calculator': 'trending-down',
  'risk-of-ruin-calculator': 'percent',
  'risk-reward-calculator': 'arrow-left-right',
  'dca-calculator': 'layers',
  'crypto-profit-calculator': 'calculator',
  'kelly-criterion-calculator': 'sigma',
  'sharpe-ratio-calculator': 'activity',
};

/** Only calculators whose page exists are grouped; the rest are listed as "in development". */
export const TOOL_GROUP: Partial<Record<ToolSlug, ToolGroup>> = {
  'liquidation-price-calculator': 'risk',
  'drawdown-calculator': 'risk',
  'leverage-calculator': 'planning',
  'position-size-calculator': 'planning',
  'risk-of-ruin-calculator': 'edge',
  'risk-reward-calculator': 'edge',
  'kelly-criterion-calculator': 'edge',
};
