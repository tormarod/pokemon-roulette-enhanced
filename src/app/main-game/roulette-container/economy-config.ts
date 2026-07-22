import { isMegaStoneItemName } from '../../services/items-service/mega-stone-names';
import { isAbilityCapsuleName } from '../../services/items-service/ability-capsule-names';

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
  'potion': 25,
  'super-potion': 40,
  'hyper-potion': 55,
  'x-attack': 15,
  'rare-candy': 40,
  'revive': 50,
  'ability-capsule': 35,
  'honey': 45,
} as const; // tunable

export type MarketEntryId = keyof typeof MARKET_PRICES;

/** Fraction of the Market buy price paid back when selling a Market-sold item. */
export const SELL_RATE = 0.4; // tunable
/** Flat coin value for selling a find-only gadget (never sold by the Market). */
export const GADGET_SELL_VALUE = 5; // tunable

/**
 * Coins paid for selling a held item, or `undefined` if it can't be sold
 * (mega stones — build pieces, not economy fodder). Market-sold items
 * (including ability capsules, priced via the synthetic `ability-capsule`
 * entry) sell for `SELL_RATE` of their buy price; everything else (find-only
 * gadgets) sells for the flat `GADGET_SELL_VALUE`. Always strictly less than
 * the buy price, so there's no buy/sell arbitrage loop.
 */
/**
 * Per-run Market stock caps (`MarketStockService`). Every entry starts at
 * capacity; buying decrements; stock does NOT auto-refill on round advance —
 * the only refill is the paid Restock action. Keys must cover every
 * `MarketEntryId` (`MARKET_PRICES`).
 */
export const MARKET_STOCK: Record<MarketEntryId, number> = {
  'potion': 3,
  'super-potion': 2,
  'hyper-potion': 1,
  'x-attack': 5,
  'rare-candy': 3,
  'revive': 1,
  'ability-capsule': 5,
  'honey': 3,
}; // tunable

/** Paid Restock pricing: `restockPrice(n) = RESTOCK_BASE + RESTOCK_STEP * n`. */
export const RESTOCK_BASE = 60; // tunable
export const RESTOCK_STEP = 40; // tunable
/** Hard cap on how many times Restock can be used in a single run. */
export const RESTOCK_MAX_USES = 3; // tunable

export function sellValue(itemName: string): number | undefined {
  if (isMegaStoneItemName(itemName)) {
    return undefined;
  }
  if (isAbilityCapsuleName(itemName)) {
    return Math.floor(MARKET_PRICES['ability-capsule'] * SELL_RATE);
  }
  if (itemName in MARKET_PRICES) {
    return Math.floor(MARKET_PRICES[itemName as MarketEntryId] * SELL_RATE);
  }
  return GADGET_SELL_VALUE;
}
