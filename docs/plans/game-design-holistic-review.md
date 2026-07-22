# Plan: Holistic design review — amplify agency & reconcile the economy

Status: **Not started.**
Owner: tormarod
Last updated: 2026-07-22

## Why (the diagnosis)

A whole-game review (2026-07-22 session) surfaced one structural theme and a few
seams:

- **The agency superstructure sits on a power economy too compressed to feel
  it.** The game keeps adding informed-choice systems — symmetric type matchup,
  opponent preview, mandatory lead pick, a 30-ability roster, a coin Market — but
  base power caps at 5 (most final evolutions are 3), so a full team tops out at
  ~19 Yes tickets. Meanwhile No tickets grow unbounded with `round`
  (`ceil(round × 1.5)` → 18 by the Champion). The sum of *every* decision the
  player can make (matchup delta, lead pick, X Attack, abilities) is on the order
  of ±10 tickets against a No pool near 19 — so the back half is a coin flip the
  player can barely influence. This is the root; the endgame `round-threat-rebalance`
  plan already targets its two biggest levers.
- **The Market was bolted onto a reward set designed before coins existed.** Find
  Item overlaps the Market (~36% of its wheel by weight is stuff you can just
  buy), unwanted items can't convert back to coins, and one threat (Toll Booth)
  weaponises the economy against the player. These are the "old reward loop meets
  new economy" seams.

## Decisions locked (2026-07-22 session — recorded so they aren't re-litigated)

- **Q1 — Endgame coin-flip → amplify the choice levers + flatten the round ramp.**
  This *is* `docs/plans/round-threat-rebalance.md` (lower `ROUND_THREAT_MULT`,
  double the matchup unit). This plan treats that as **Phase 0** and builds on the
  post-rebalance baseline; it does **not** re-rescale raw Pokémon power (rejected:
  editing power on 1025 mons + every downstream number is high blast radius for a
  cosmetic gain over what the levers already achieve).
- **Q2 — Loss stakes → no change (rejected a "second wind" mechanic).** Potions
  already *are* the in-battle retry (up to 3 via Hyper), and runs are ~5–10 min,
  so the "20-minute run erased" premise is weak; a non-buyable survival item would
  just duplicate potions. If loss-feel ever needs tuning, the lever is potion
  availability / retry counts, not a new system.
- **Q3 — "Dead" late catches → no active work (deferred to backlog).** The PC
  bench is *not* dead weight: with the opponent preview + matchup system, catches
  7–10 buy type coverage you swap in per fight, and that gets **more** valuable
  once Phase 0 amplifies the matchup unit. The 3-pick adventure draw already lets
  a player skip an unwanted catch. Re-evaluate late-catch feel only *after* Phase 0
  ships (backlog note) rather than engineering a fix for a non-problem now.
- **Q4 — Threats → keep them no-choice, fix only the Toll Booth economy
  coupling.** The Danger meter only works if threats bite; adding a
  spend-to-reroll would dilute the tension engine. The one genuine defect is Toll
  Booth punishing you for being coin-poor right after the game told you to spend at
  the Market (Phase 4).
- **Bake-ins (no separate question):** Find Item ↔ Market disjoint inventories
  (Phase 2), sell-for-coins (Phase 3), potion "Gym battle" text fix (Phase 5).

Checkpoint after each phase — do not run several in one stretch.

---

## Phase 0 — Foundation (prerequisite): endgame rebalance

Execute **`docs/plans/round-threat-rebalance.md`** in full (its Phases 1–4:
lower `ROUND_THREAT_MULT`, double `getMemberDelta` to `ceil(power/2)`, docs). It is
already fully specified there and is **not** duplicated here. Everything below
assumes the post-rebalance baseline — in particular Phase 1 must be *measured on
top of* the doubled matchup unit, not before it. If the two plans ship in the same
release, coordinate a single version bump / release-notes entry (see Phase 6).

- [ ] **Phase 0** — land `round-threat-rebalance.md`. Checkpoint.

---

## Phase 1 — Ability magnitude parity pass (measure, then tune)

**Why:** after Phase 0 doubles the matchup unit, a flat `+1..3` ability
(`abilities-data.ts`) is a smaller share of a bigger swing, so the elaborate
build-toward-abilities loop risks feeling pointless. This phase checks that and
bumps magnitudes only if warranted — it is deliberately conservative so Phase 0 +
Phase 1 don't stack into over-easing.

**Current system (read first):**
- `AbilityService.applyTeamAbilities()`
  (`src/app/services/ability-service/ability.service.ts:39`) folds each member's
  assigned ability into `{yesBonus, noBonus, extraRetry}`; consumed by
  `BattleOddsService.computeOdds()` (`abilityYes`/`abilityNo`).
- Magnitudes live in `abilitiesById`
  (`src/app/services/ability-service/abilities-data.ts:96`) via the `value` field.
  Flat/conditional effects are `1–3`; `scale-with-*` use `value` as a cap;
  `extra-retry` / `faint-immune-lead` / `zero-own-negative` ignore `value`.

**Sub-phases:**
- [ ] **1a — Measure.** Add a throwaway spec (delete after) in
  `.../ability-service/` that, at the Phase-0 matchup unit (`ceil(power/2)`), logs
  each ability's ticket impact on a representative team (e.g. 6× power-3) and
  compares it to one matchup point (`= ceil(3/2) = 2` per net-score point). Report
  the table. **Stop for the owner to lock a target parity** (recommendation: a
  strong ability should be worth roughly one favourable matchup point, i.e. ~2–4
  tickets, not 1).
- [ ] **1b — Apply locked values.** Bump the flat magnitudes in `abilities-data.ts`
  toward the locked target (starting recommendation, pending 1a: `flat` and
  `offense-if-positive` values `1→2`, `2→3`; keep `soak`/`intimidate`-style No
  shifts symmetric; raise `scale-with-*` caps `3→4`). Update
  `ability.service.spec.ts` assertions. `npm run test:local` green. Checkpoint.

**Note (not in scope):** the `team-synergy` effect (`synchronize`, +value Yes per
same-type teammate) rewards mono-type stacking, which pulls against the type
coverage the matchup math rewards. This is a legitimate high-risk build choice,
**not** a bug — left as-is; see backlog if it proves degenerate in playtest.

---

## Phase 2 — Find Item ↔ Market disjoint inventories

**Why:** the Find Item adventure card (reward-pool weight 2) rolls all 14 regular
items, ~36% of which (by weight) are the six consumables the Market already sells
on demand — so a Find Item pick can feel like a dud ("I could've just bought
this"), and the player can't steer toward the find-only gadgets that are the
card's real value. Making the inventories disjoint means Find Item **always**
hands you something the Market never stocks.

**Current system:**
- `FindItemRouletteComponent`
  (`.../roulettes/find-item-roulette/find-item-roulette.component.ts:31`) builds
  its wheel from `ItemsService.getRegularItems()` (all 14, minus Revive in
  Classic).
- Market stock (`market.component.ts:156`) = `potion, super-potion, hyper-potion,
  x-attack, rare-candy, revive` + random capsule.

**Change (New Experience only; Classic unchanged — it has no Market):**
- [ ] Add `ItemsService.getFindableItems()`: in New Experience, return
  `getRegularItems()` filtered to exclude the Market-sold consumable names
  (`potion, super-potion, hyper-potion, x-attack, rare-candy, revive`), leaving the
  find-only gadgets (`bicycle, exp-share, escape-rope, honey, repel, poke-radar,
  max-repel, link-cable`). In Classic, return `getRegularItems()` unchanged.
- [ ] Point `FindItemRouletteComponent`'s constructor at `getFindableItems()`.
- [ ] Update `find-item-roulette.component.spec.ts` and any `items.service.spec.ts`
  assertion. `npm run test:local` green. Checkpoint.

**Acceptance:** in New Experience, the Find Item wheel never shows a Market
consumable; in Classic, the wheel is identical to today.

---

## Phase 3 — Sell-for-coins (close the economy loop)

**Why:** there is no way to turn an item into coins. A bias item found with a full,
settled team is pure dead weight — and after Phase 2 the Find Item card *only* hands
out gadgets, so a full-team player finding one gets nothing. A sell action makes
every item at least *something* and gives the economy a second, player-driven
faucet. (No arbitrage: you buy high and sell low, and items aren't a coin faucet,
so there's no farming loop — confirm sell value < buy price.)

**Current system:**
- `TrainerService.removeItem(item)` (`trainer.service.ts:469`),
  `addCoins()` (`:533`), `spendCoins()` (`:540`), `getCoinsObservable()` — all
  already persisted by `RunPersistenceService`.
- `MarketComponent` (`.../market/market.component.ts`) already gates on
  `isNewExperienceMode` + `isAvailable` (closed during combat/prep).

**Change (New Experience only):**
- [ ] Add `SELL_RATE = 0.4` and `GADGET_SELL_VALUE = 5` (coins) to
  `economy-config.ts`, plus `sellValue(itemName)`: Market consumables →
  `floor(MARKET_PRICES[id] × SELL_RATE)`; gadgets → `GADGET_SELL_VALUE`. **Decide
  (owner):** ability capsules sellable at `floor(50 × SELL_RATE)`; mega stones
  **not** sellable (build pieces, not fungible). Recommendation baked in: capsules
  yes, mega stones no.
- [ ] Add a "Sell" section to the Market modal listing the player's held sellable
  items (dedup by name with a count), each with a sell button →
  `removeItem` + `addCoins(sellValue)`. Reuse the existing affordable/disabled
  styling and the combat-lockout (`isAvailable`) so a sale can't react to a shown
  loss, same fairness rule as buying.
- [ ] `market.component.spec.ts` cases (sell removes item + credits coins; disabled
  in combat). `npm run test:local` green. Checkpoint.

**Acceptance:** selling a Potion yields `floor(15×0.4)=6` coins and removes it;
selling is unavailable during a battle spin / committed prep.

---

## Phase 4 — Toll Booth economy decoupling

**Why:** the game pushes you to spend coins at the Market, then the Toll Booth
threat (`roulette-container.component.ts:1035`) charges a fixed `15 + 3×round` and
**spikes the Danger meter** scaled to the unpaid fraction when you're short — so
spending as intended is exactly what exposes you. That trap-coupling is the defect.

**Current system:**
- `tollAmount(round) = 15 + 3*round` (`:1025`); `tollBooth()` pays
  `min(balance, toll)` then, if short, `applySpike(5|10|15)` by unpaid fraction
  (`:1043`).
- `excludedThreatIds()` (`:916`) already filters no-op threats (e.g. `pcLockout`
  when `total <= 1`) so they aren't drawn.

**Change — recommended (owner may flip to the low-risk alternative below):**
- [ ] Make the toll a **percentage of current coins**, not a fixed amount:
  `tollAmount = Math.max(TOLL_FLOOR, Math.ceil(coins × TOLL_RATE))`
  (recommend `TOLL_RATE = 0.4`, `TOLL_FLOOR = 5`), and **remove the shortfall
  danger-spike branch entirely**. You can't be "short" on a fraction of what you
  hold, so a spender is never punished and a hoarder pays a bit more — a clean coin
  sink instead of a trap.
- [ ] Exclude Toll Booth when the wallet is empty: in `excludedThreatIds()`, push
  `'tollBooth'` when `this.trainerService.getCoins() === 0` (consistent with the
  existing no-op-threat filter). This makes a 0-coin toll a genuine no-op rather
  than a punishment.
- [ ] Update `tollBooth`'s modal copy (drop the `spike` message path) and any
  toll spec. `npm run test:local` green. Checkpoint.

**Design-guardrail note:** this deliberately **reverses** the
`threat-mechanics-expansion.md` rule "being short must never be a costless no-op"
*for Toll Booth specifically* — accepted here because that rule is what creates the
market-spending trap. Call it out in release notes.

**Low-risk alternative (one-number, if the owner prefers):** keep the fixed toll +
shortfall mechanic but cut the spike cap from `15` to `~5`, so being broke is a
wrist-slap, not a punishment. Preserves the old guardrail; less clean.

---

## Phase 5 — Potion text fix (legibility)

**Why:** `items.{potion,super-potion,hyper-potion}.description` still say
"whenever you would lose a **Gym** battle," but retries apply to every battle type
now (rival, Elite Four, Champion) — the wording makes players undervalue the single
most important consumable and, by extension, buying it at the Market.

- [ ] Reword the three descriptions to "any battle" (or equivalent) in
  `src/assets/i18n/en.json` (real) and the other five locale files
  (`de, es, fr, it, pt` — translated where practical, English placeholder
  otherwise). No code change. Checkpoint.

---

## Phase 6 — Docs, version, release notes

- [ ] Update `README.md` where touched: the **Economy & the Market** section (Find
  Item now disjoint from the Market; sell-for-coins; Toll Booth is a % coin sink),
  and note the ability-magnitude change if Phase 1 shipped a bump.
- [ ] Bump `package.json` `version` (confirm current first) and add a newest-first
  `RELEASE_NOTES` entry (`src/app/data/release-notes.ts`) with
  `whatsNew.v<x>_<y>_<z>.*` keys + a `v<x>_<y>_<z>` label in **all six** locale
  files (`en` real, others English placeholder). Call out the Toll Booth guardrail
  change and (if shipped) the ability bump.
- [ ] **Coordinate with Phase 0:** if this ships together with
  `round-threat-rebalance.md`, fold both into one version bump / one release-notes
  entry rather than two. Move **both** plan files to `docs/plans/done/` once all
  phases are complete.

---

## Acceptance tests (input → expected)

1. **Find Item disjoint (Phase 2).** New Experience, open Find Item wheel → the
   wheel contains only `bicycle, exp-share, escape-rope, honey, repel, poke-radar,
   max-repel, link-cable`; contains no `potion/super-potion/hyper-potion/x-attack/
   rare-candy/revive`. Classic mode → wheel unchanged (all 14 minus Revive).
2. **Sell (Phase 3).** Hold a Potion, coins = C → sell → coins = `C + 6`, Potion
   gone. During a committed battle prep → the Sell buttons are disabled.
3. **Toll Booth, recommended (Phase 4).** coins = 100, any round → toll =
   `ceil(100×0.4)=40`, coins → 60, **no** Danger spike. coins = 0 → `tollBooth`
   not in the threat draw (`excludedThreatIds` includes it).
4. **Potion text (Phase 5).** `items.potion.description` no longer contains the
   word "Gym" in `en.json`.
5. **Abilities (Phase 1, if bumped).** A `flat-yes` ability's `value` matches the
   locked target; `ability.service.spec.ts` recomputed and green.
6. **Full suite green** after every phase's spec updates.

## Risks

- **Over-easing (Phase 0 + Phase 1 stack).** Measure abilities *after* Phase 0's
  doubled unit; keep the bump conservative and gated on the 1a table.
- **Toll Booth guardrail reversal** is a deliberate, player-facing difficulty
  change — required release-notes callout, not optional.
- **Sell arbitrage** — none as designed (buy high / sell low, items aren't a
  faucet); confirm `sellValue < buy price` for every sellable item.
- **Version/release-notes double-bump** if this and `round-threat-rebalance` ship
  separately vs together — coordinate in Phase 6.
