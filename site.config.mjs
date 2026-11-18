// Outbound exits and the region gate. This is the one place to change them.
//
// vercel.json is GENERATED from this file:  npm run gen:vercel
// (vercel.json is plain JSON and cannot carry comments, and Vercel reads it
// before the build runs, so the generated file is checked in. A test fails if
// the two drift apart.)

// Placeholder: replace with affiliate link.
// Until the Bybit affiliate link exists this sends people to the Bybit home page.
export const BYBIT_TARGET = 'https://www.bybit.com/';

// === AFFILIATE SWITCH ====================================================
// false = BYBIT_TARGET is a plain link and the site earns nothing from it.
//         Every disclosure line, the footer and /disclosure/ say exactly that.
// true  = BYBIT_TARGET is a real affiliate link. Flip this in the same commit
//         that replaces BYBIT_TARGET, never before: the pages would then claim
//         a commission that does not exist.
export const AFFILIATE_ACTIVE = false;
// =========================================================================

// Bybit's testnet. Not an affiliate link; gated the same way as the live exit.
export const BYBIT_TESTNET_TARGET = 'https://testnet.bybit.com/';

// Visitors from these countries are sent to /not-available/ instead of Bybit.
// ISO 3166-1 alpha-2, matched against Vercel's x-vercel-ip-country header.
export const RESTRICTED_COUNTRIES = ['US', 'CA', 'CN', 'HK', 'SG', 'GB'];

// === TAIWAN GATE =========================================================
// true  = Taiwan is treated like a restricted country (current decision).
// false = Taiwan visitors are sent on to Bybit.
// After changing it run `npm run gen:vercel` and commit vercel.json.
export const GATE_TW = true;
// =========================================================================

/** Path every affiliate action links to. */
export const GO_BYBIT = '/go/bybit/';
/** Path every testnet action links to. */
export const GO_BYBIT_TESTNET = '/go/bybit-testnet/';

export const NOT_AVAILABLE_PATH = '/not-available/';

/** exit path -> where it goes for visitors outside the gated countries */
export const EXITS = {
  [GO_BYBIT]: BYBIT_TARGET,
  [GO_BYBIT_TESTNET]: BYBIT_TESTNET_TARGET,
};

export function gatedCountries() {
  return GATE_TW ? [...RESTRICTED_COUNTRIES, 'TW'] : [...RESTRICTED_COUNTRIES];
}
