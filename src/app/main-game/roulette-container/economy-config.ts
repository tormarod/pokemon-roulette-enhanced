/**
 * Central tuning dials for the New-Experience coin economy (see
 * docs/plans/economy-and-market.md). All values are proposed starting points —
 * the owner locks them from measured numbers in the plan's balance phase, so keep
 * every magic number here rather than scattered at the call sites.
 */

/** Flat coins every battle win pays before round scaling. */
export const WIN_BASE = 10; // tunable
/** Extra coins per round already cleared, added to the win drop. */
export const WIN_PER_ROUND = 3; // tunable
/**
 * Flat per-round stipend, added on top of the win drop only where the round
 * actually advances (gym / elite four). Rounds never advance without a win, so
 * this is genuinely once-per-round and can't be farmed by `multitask` (which
 * neither wins a battle nor advances the round).
 */
export const PASSIVE_PER_ROUND = 5; // tunable

/** Inclusive coin range for the reward cards that drop a coin bonus. */
export const CARD_COIN_MIN = 5; // tunable
export const CARD_COIN_MAX = 15; // tunable

/** Coins paid for winning a battle at `round` (rounds already cleared). */
export function battleWinReward(round: number): number {
  return WIN_BASE + round * WIN_PER_ROUND;
}

/** Uniform random integer in [min, max]. */
export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** A single reward card's coin bonus, in [CARD_COIN_MIN, CARD_COIN_MAX]. */
export function cardCoinReward(): number {
  return randInt(CARD_COIN_MIN, CARD_COIN_MAX);
}

/**
 * The repurposed "found coins" card pays a bigger one-off bundle than a card
 * bonus, since coins are its whole reward (New Experience only; Classic keeps the
 * old free-potion behaviour).
 */
export const FOUND_COINS_MIN = 20; // tunable
export const FOUND_COINS_MAX = 40; // tunable

export function foundCoinsReward(): number {
  return randInt(FOUND_COINS_MIN, FOUND_COINS_MAX);
}

/**
 * Market shelf prices, in coins. Keys are the market entry ids: regular item
 * names plus the synthetic `ability-capsule` (a random capsule). All tunable —
 * locked in the plan's balance phase.
 */
export const MARKET_PRICES = {
  'potion': 15,
  'super-potion': 30,
  'hyper-potion': 50,
  'x-attack': 25,
  'rare-candy': 40,
  'revive': 60,
  'ability-capsule': 50,
} as const; // tunable

export type MarketEntryId = keyof typeof MARKET_PRICES;
