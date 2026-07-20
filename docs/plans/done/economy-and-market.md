# Plan: Economy & Market (player agency + power via items)

Status: **Not started.**
Owner: tormarod
Last updated: 2026-07-20
Scope: **New Experience mode only.** Classic mode is untouched.

## Why

The three between-round choices are unbalanced: **catching is near-always the best
pick until the team is 6-strong.** This is structural, not a weighting bug:

- Win odds come almost entirely from the **team** (`BaseBattleRouletteComponent`
  builds Yes-tickets from team power + type matchup). The team is the only durable
  lever that raises the green slice count.
- The only *power* item is `x-attack` (one-shot, consumed); potions/revive are a
  **loss safety net** (retries); everything else is evolution-helper or flavor.
- Assignable **abilities** (`AbilityService`, via ability capsules) are the other
  real power lever — flat-yes / flat-no / synergy / scaling odds adjustments.

So every non-catch reward is either a consumable safety net or flavor, and catching
adds permanent Yes-tickets → catch strictly wins. The fix is **not** a new stat item
(abilities already fill that role — a "+1 power" item would just be a worse ability).
The fix is an **economy**: a per-run **coin** currency earned from wins, adventure
cards, and a small passive stipend, spent in an always-available **Market** to acquire
the power/safety levers that already exist (potions, x-attack, ability capsules, revive,
rare candy). This does two things:

1. Gives the player **agency** to convert progress into power (steer around RNG).
2. Makes **non-catch choices feed the economy** (many reward cards drop coins), so
   picking "battle trainer" / "go fishing" is no longer wasted value.

### How this coordinates with round-threat rebalancing

`docs/plans/round-threat-rebalance.md` diagnoses that battle **No-tickets outscale any
team's Yes-tickets** (~60% ceiling at Champion even fully advantaged). Two levers close
that gap:

- **Lower round-threat** — a *flat* buff to everyone (raises the floor).
- **This economy** — an *earned* buff that rewards engagement (raises the ceiling).

They are complementary. **Sequence: build the economy first, re-measure the attainable
endgame win-curve, then decide the round-threat cut last** (Phase 6) — likely a gentler
cut than the standalone plan's 1.0, or none, if a well-played economy already lifts
engaged players past the ceiling while round-threat keeps passive runs hard. **This plan
supersedes `round-threat-rebalance.md`**, folding its multiplier decision into Phase 6.
> The owner is actively editing `round-threat-rebalance.md`; re-read that file at the
> start of Phase 6 and reconcile its final recommendation with the measured post-economy
> numbers before locking the multiplier.

## Decisions (resolved by owner — bake these in)

1. **Currency = "Coins"** — a generic term with no Nintendo IP (no "PokéDollars"/"₽").
   Internal field name `coins`; display as a plain number with a generic coin
   icon/emoji and the word "Coins"; i18n under an `economy.*` namespace.
2. **Shop = "Market"** — likewise generic (no "Poké Mart"). Component `MarketComponent`.
3. **Ability-capsule purchase = random.** Buy a random capsule at a fixed price (mirrors
   the existing `find-ability-capsule` flow). A choose-your-capsule UI is a later
   enhancement, out of scope here.
4. **Market opens only outside combat.** Available whenever the team strip is visible on
   non-battle screens (adventure / start-adventure), *never* during a battle spin or the
   prep panel — so a purchase can't undo a shown loss or react to shown odds. Preserves
   the run-persistence anti-reroll fairness invariant.
5. **Starting balance dials** (§ "Proposed economy dials") are *proposed*; the owner locks
   final values in Phase 5 from measured numbers, same as the round-threat plan's approach.

## Current system (read before touching code)

- **Between-round choices**: `main-adventure-roulette.component.ts` draws 3 cards from
  `rewardPool` (or 1 threat card) and routes the pick to an `@Output` handled by
  `roulette-container.component.ts`. The `buyPotions` card there
  (`roulette-container.component.ts` `buyPotions()`) is a *fake shop* — it just hands a
  free potion scaled by badge count. This plan repurposes coin drops and adds the real
  Market; **keep or repurpose `buyPotions` per Phase 3**.
- **Per-run resource state** lives in `TrainerService`
  (`src/app/services/trainer-service/trainer.service.ts`): items and badges are each a
  plain field + `BehaviorSubject`, with `get…Observable()`, `add…`, `reset…`, `restore…`
  methods (see `trainerItems`/`trainerBadges` around lines 314–483). **Coins mirror this
  exactly.**
- **Persistence**: `RunPersistenceService`
  (`src/app/services/run-persistence-service/run-persistence.service.ts`) — `SavedRun`
  interface (line 17), the `combineLatest` auto-save (line 67), `restoreRun` (line 162),
  and `isValidSavedRun` (line 208). Every new persistent field is wired in all four
  places. Coins are per-run → also reset in `startFreshRun` (line 146).
- **Item catalogue**: `ItemsService` + `items-data.ts` / `ability-capsules-data.ts`.
  `getRegularItems()` already filters `revive` to New-Experience-only.
- **Ability capsule flow**: `find-ability-capsule-roulette.component.ts` emits an
  `ItemItem` carrying an `abilityId`; the container bags it via
  `trainerService.addToItems(...)`; the player assigns it later in the PC/ability UI.
  **Buying a capsule = the same `addToItems` call** — no new assign flow needed.
- **Modal pattern for the Market**: mirror `storage-pc.component.ts` — a standalone
  component opened via `NgbModal` from `trainer-team.component.ts`, whose template lives
  in the always-visible team strip (so a "Market" button sits next to the PC button).
- **Battle result**: each battle roulette emits `battleResultEvent(boolean)` →
  `roulette-container.component.ts` handles win/loss and advances the round. The **win
  coin drop hooks here**; the **passive stipend hooks the round-advance**.

## Proposed economy dials (starting values — tune in Phase 5)

All in coins. Marked `// tunable` in code like `items-data.ts` weights.

**Earning**
- Win drop: `WIN_BASE + round × WIN_PER_ROUND`. Start **WIN_BASE = 10, WIN_PER_ROUND = 3**
  (gym round-0 win → 10 coins; Champion round-12 → 46).
- Passive stipend: granted **once per round advance** (not per adventure draw — else
  `multitask`'s extra draws farm coins). Start **PASSIVE = 5** (flat).
- Card drops: a `coinReward` on selected reward cards (in addition to their effect).
  Start: `battleTrainer, goFishing, exploreCave, snorlaxEncounter, teamRocket, findFossil`
  each drop **5–15 coins** (uniform random). Others drop nothing.

**Prices (Market)**
| Item | Coins | Note |
|------|-------|------|
| Potion | 15 | 1 retry |
| Super Potion | 30 | 2 retries |
| Hyper Potion | 50 | 3 retries |
| X-Attack | 25 | one-shot power |
| Revive | 60 | rescue fainted |
| Rare Candy | 40 | force evolution |
| Ability Capsule (random) | 50 | durable power lever |

Design intent for tuning: **wins + card drops are the dominant faucet**; passive is a
guaranteed *floor* so the Market is always eventually worth opening, but never the main
source. A player should afford roughly one meaningful item every 1–2 rounds, not stockpile
everything.

## Phased steps

Checkpoint after each phase — do not run multiple phases in one go.

- [x] **Phase 1 — Currency foundation (state + persistence, no UI, no earning yet).** ✅ Done 2026-07-20 — coins state added to `TrainerService` (get/add/spend/reset/restore + observable), wired into `RunPersistenceService` (SavedRun field, combineLatest, persist, restore `?? 0`, validate optional, `startFreshRun` reset); 13 new specs; full suite green (809).
  1. In `TrainerService`, add `coins` mirroring the badges pattern: a private `coins = 0`
     field + `private coinsObservable = new BehaviorSubject<number>(0)`, and methods
     `getCoins(): number`, `getCoinsObservable(): Observable<number>`,
     `addCoins(amount: number): void`, `spendCoins(amount: number): boolean` (returns
     false and no-ops if `amount > coins`), `resetCoins(): void` (→ 0), and
     `restoreCoins(amount: number): void`. Each mutator calls `this.coinsObservable.next(this.coins)`.
  2. In `RunPersistenceService`: add `coins: number` to `SavedRun`; add
     `this.trainerService.getCoinsObservable()` to the `combineLatest` source list and its
     destructure; persist `coins` in `persistRun`; restore via
     `this.trainerService.restoreCoins(run.coins ?? 0)` in `restoreRun`; validate
     `(run.coins === undefined || typeof run.coins === 'number')` in `isValidSavedRun`;
     add `this.trainerService.resetCoins()` to `startFreshRun`.
  3. Unit-test the service methods (spend guard, reset, restore) and add a persistence
     round-trip assertion alongside the existing `run-persistence.service.spec.ts` cases.
  Acceptance: `npm run test:local` green; a run can hold, spend-guard, persist, and restore
  a coin balance. **No player-visible change yet.**

- [x] **Phase 2 — Earning (win drop + passive stipend + card drops).** ✅ Done 2026-07-20.
  Dials in `roulette-container/economy-config.ts`. Win drop `WIN_BASE + round×WIN_PER_ROUND`
  on gym/elite/rival wins; `PASSIVE_PER_ROUND` folded into gym/elite wins only (the
  round-advancing ones) so it lands exactly once per round — no separate observer, and
  `multitask` can't farm it (verified by spec). Champion win pays nothing (run ends).
  Card bonus (`cardCoinReward()`, 5–15) on exploreCave / snorlaxEncounter / goFishing /
  findFossil / battleTrainer. **`teamRocket` deliberately excluded** — its handler is
  shared with the Team Rocket *ambush threat*, so paying it would reward a threat.
  Communication via an **animated coin counter** in the team strip (amber pill, self-styled
  for both themes, "+N" rise-and-fade floater + pulse on gain) rather than per-gain modals.
  i18n `trainer.team.coins` / `coinsTooltip` added with real translations in all six
  locales. +10 specs (economy-config + container earning/gating/multitask-safety); suite
  green (819). The `buyPotions` card repurpose stays in Phase 3 as scheduled.
  1. Win drop: in `roulette-container.component.ts`, on a winning `battleResultEvent`
     (New-Experience only), `trainerService.addCoins(WIN_BASE + round × WIN_PER_ROUND)`.
     Locate the single win-handling path (gym/rival/elite/champion converge through the
     container's battle-result handler); grep `battleResultEvent`/`leadersDefeatedAmount`.
  2. Passive stipend: grant `PASSIVE` exactly once per round advance. Hook the same place
     the round counter increments (New-Experience only). Guard against `multitask`
     re-entry so it fires per *round*, not per adventure draw.
  3. Card drops: add an optional `coinReward?: [min, max]` to the reward-card handlers
     listed in the dials, granting `randInt(min,max)` when routed. Keep the card's existing
     effect. Define constants centrally (a small `economy-config.ts` or `const`s in the
     container) so Phase 5 tuning has one edit site.
  4. Show the balance: bind `getCoinsObservable()` into the team strip
     (`trainer-team.component.ts` + template) as a small coin counter next to badges.
  Acceptance: winning grants the scaled drop; each round grants exactly one stipend
  (verified across a `multitask` burst — no double-grant); the listed cards drop coins; the
  counter updates live and survives reload. New/updated specs green.

- [x] **Phase 3 — Market modal (spending).** ✅ Done 2026-07-20. New standalone
  `MarketComponent` (`trainer-team/market/`, mirrors `storage-pc`): NgbModal of stock rows
  (potion/super/hyper, x-attack, rare-candy, revive, random ability capsule) with prices in
  `economy-config.ts` `MARKET_PRICES`; rows disable when unaffordable; buying `spendCoins`
  then `addToItems` (capsule = random from `getAbilityCapsules`, assigned later in PC).
  "Market" button in the team strip, hidden in Classic mode and disabled during
  battle/prep (`combatStates`). `buyPotions` card repurposed: New Experience → coin bundle
  (`foundCoinsReward`, 20–40) shown via a new `coinsFoundModal`, labelled "Found Coins"
  (id unchanged); Classic keeps the free potion. i18n `market.*` + `actions.foundCoins` +
  `altPrizes.foundCoins` added with real translations in all six locales. Theme-aware
  (self-styled amber balance pill, rows inherit modal theme). +7 market specs; suite green
  (827). Also fixed an adjacent **mega-persistence bug** discovered mid-phase (mega battle
  state now persisted so a reload can't strand a permanent mega — see run-persistence).
  1. New standalone `MarketComponent` (mirror `storage-pc.component.ts`): an `NgbModal`
     listing the stock table with prices, each row disabled when `coins < price`. Buying
     calls `spendCoins(price)` then the grant:
     - potions / x-attack / revive / rare-candy → `trainerService.addToItems(itemsService.getItem(name))`.
     - ability capsule → pick a random capsule from `itemsService.getAbilityCapsules()` and
       `addToItems` it (same as the find flow); the player assigns it later in the PC UI.
     Reuse existing item-used / found audio + sprites.
  2. Add a **"Market" button** to the team strip (`trainer-team.component.html`),
     next to the PC button, opening the modal. Per Decision 4, gate visibility to
     non-battle screens (check `gameStateService.currentState` / a helper, excluding battle
     + prep states).
  3. Repurpose the fake `buyPotions` card: either (a) grant a coin bundle instead of a free
     potion (rename card key to a "found money" flavor), or (b) remove it from `rewardPool`
     now that a real Market exists. Recommend (a) — keep the card, make it a coin drop.
  Acceptance: opening the Market, buying an affordable item deducts coins and bags the item;
  unaffordable rows are disabled; a bought capsule is assignable in the PC UI; the Market is
  hidden during battles/prep; purchases persist across reload. Specs green.

- [ ] **Phase 4 — i18n + first-pass polish.** Add all new user-facing strings (currency
  label + "Coins", Market title, buy button, "not enough" states, the repurposed card) to
  **all six** locale files (`en` real, others English placeholder). Verify the coin counter,
  Market, and card copy render in every locale without missing-key fallbacks.

- [x] **Phase 5 — Balance measurement + tuning (owner locks the dials).** ✅ Done 2026-07-20.
  Computed the coin economy for a representative 8-gym gen: guaranteed **floor = 378 coins**
  by the Champion (12 round-advancing wins: win base 120 + passive 60 + round scaling 198);
  engaged upside +100–250 (rivals + coin cards + found-coins). At current prices that floor
  buys ~6 ability capsules (one per team member) with change — a deliberate counter to the
  ~60% late-game ceiling. **Owner locked the starting dials as-is**, to be validated against
  round-threat in Phase 6. Instrument or
  hand-simulate a full run to report, at Champion: total coins earned by a *passive* player
  (wins + stipend, no coin-cards) vs an *engaged* player (also picking coin-cards), and what
  each can afford. Present a short table; **stop for the owner to lock** WIN_BASE,
  WIN_PER_ROUND, PASSIVE, card ranges, and prices. Apply the locked values.

- [x] **Phase 6 — Round-threat: delegated to the standalone plan.** ✅ Resolved 2026-07-20.
  The owner expanded `docs/plans/round-threat-rebalance.md` into a self-contained **two-lever**
  plan (Lever A: lower `ROUND_THREAT_MULT`; Lever B: double the `getMemberDelta` matchup unit)
  with its own owner decisions and phases. This economy plan does **not** supersede or touch
  battle No-scaling — the two are complementary. Note for whoever runs the round-threat plan:
  its win-curve tables are computed for a **bought-power-free** team; the economy only adds
  *upside* on top (an engaged player reaches advantaged/ability-boosted teams more often), so
  if anything it argues for the **conservative** Lever-A value (1.25, the plan's recommendation)
  rather than a larger cut. No action here.

- [x] **Phase 7 — Docs, version, release notes.** ✅ Done 2026-07-20. README: added the
  economy/Market feature bullet + a new "Economy & the Market" section, and updated Run
  persistence to note coins + mega battle state are saved. `package.json` 3.6.0 → **3.7.0**.
  `RELEASE_NOTES` top entry `3.7.0` with `whatsNew.v3_7_0.{0,1,2}` (coins, Market, mega fix)
  + `v3_7_0` version label added to **all six** locales with real translations. Credits/Coffee
  unchanged (no attribution change). Suite green (827), prod build clean.

## Acceptance tests (input → expected)

1. **Spend guard.** `coins = 10`, `spendCoins(15)` → returns false, `coins` still 10.
2. **Win drop scales.** New-Experience win at round 0 → `+10`; at round 12 → `+46`
   (with default dials).
3. **Passive fires once per round.** Advance one round with a `multitask` burst of 3
   adventure draws → exactly `+PASSIVE`, not `+3×PASSIVE`.
4. **Persistence round-trip.** Earn coins, reload → same balance restored; `isValidSavedRun`
   accepts a save with `coins` and (back-compat) one without (`?? 0`).
5. **Market purchase.** `coins ≥ price`, buy potion → `coins − price`, one potion added;
   `coins < price` → row disabled, no purchase possible.
6. **Capsule purchase.** Buying a capsule bags an `ItemItem` with an `abilityId` that is
   assignable in the PC UI exactly like a found capsule.
7. **Battle fairness intact.** Market is not openable during a battle spin or the prep panel
   (Decision 4), so a mid-battle purchase can't undo a shown loss.
8. **Full suite green** after each phase; Classic-mode behavior is unchanged throughout.

## Risks

- **Over-generous economy trivializes the game** — this is why Phase 5 (measure, then owner
  locks) precedes the round-threat re-tune. Do not ship dials un-measured.
- **Double-coordinated buffs** — economy *and* a big round-threat cut together could
  over-soften the endgame. Phase 6 explicitly re-measures with the economy live before
  choosing the multiplier; that's the whole reason round-threat is last.
- **Passive-income farming** via `multitask` extra draws — mitigated by tying the stipend
  to round-advance, not per-draw (test 3).
- **Fairness regression** — allowing purchases mid-battle would recreate the "reload to
  undo a spent consumable" class of bug the run-persistence design guards against; Decision
  4 (non-battle-only Market) prevents it.
- **Persistence back-compat** — old saves lack `coins`; every read defaults `?? 0` and the
  validator treats it optional (test 4).
- **Scope creep on capsule choice** — v1 sells a *random* capsule (Decision 3); a
  choose-your-capsule UI is a separate later enhancement.
```
