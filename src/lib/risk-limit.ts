// Read access to the Bybit risk-limit snapshots in src/data/risk-limit/.
// The snapshot is refreshed with `npm run fetch:risk-limit`; pages show its
// date so a reader can tell how old the rate is.
import btcusdt from '../data/risk-limit/BTCUSDT.json';

export interface RiskTier {
  tier: number;
  /** Upper bound of the tier, USDT of position value. */
  riskLimitValue: number;
  /** Fraction: 0.0033 is 0.33%. */
  maintenanceMargin: number;
  initialMargin: number;
  maxLeverage: number;
  mmDeduction: number;
}

export interface RiskLimitSnapshot {
  symbol: string;
  category: string;
  source: string;
  tickSizeSource: string;
  /** ISO 8601, UTC. */
  fetchedAt: string;
  tickSize: number;
  tiers: RiskTier[];
}

export const BTCUSDT: RiskLimitSnapshot = btcusdt;

/** "2026-11-18" from the snapshot's fetchedAt. */
export function snapshotDate(snapshot: RiskLimitSnapshot): string {
  return snapshot.fetchedAt.slice(0, 10);
}

export function tierOne(snapshot: RiskLimitSnapshot): RiskTier {
  return snapshot.tiers[0];
}
