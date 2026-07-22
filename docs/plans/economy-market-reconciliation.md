# Plan: Economy & Market reconciliation

Status: **Not started.**
Owner: tormarod
Last updated: 2026-07-22 (split out of the former `game-design-holistic-review.md`)

> One of two plans carved from the 2026-07-22 holistic review. **This plan is the
> economy half** — reconcile the coin Market with a reward set designed before coins
> existed. The battle-math half (endgame rebalance + ability parity) lives in
> `docs/plans/endgame-rebalance.md` and is **fully independent** (disjoint file sets,
> no cross-dependency; ship in either order or in parallel).

## Why (the diagnosis)

**The Market was bolted onto a reward set designed before coins existed.** Find Item
overlaps the Market (nearly half of its wheel by weight — ~47% — is stuff you can just
buy, now that Bicycle is a Market item too), unwanted items can't convert back to
coins, the Market has infinite stock so coins barely constrain you, and one threat
(Toll Booth) weaponises the economy against the player. These are the "old reward loop
meets new economy" seams — Phase 1 (Find Item disjoint), Phase 2 (sell), Phase 3
(stock), Phase 4 (Toll Booth), plus a Phase 5 potion-text legibility fix.

## Sibling-plan coordination (read before touching any Market/bias phase)

Three plans touch the Market/bias code — keep the ownership boundaries clean:

- **This plan** — Find Item ↔ Market disjoint, sell-for-coins, Market stock system,
  Toll Booth, potion text.
- **`docs/plans/honey-target-share-market.md`** — reworks Honey into a ~55%
  target-share bias **and sells it in the Market** (price 45). **Owns "Honey in the
  Market."** This plan must **not** re-add Honey to the Market. Because Phase 1's
  findable set is *derived* from Market stock, once the Honey plan ships Honey drops
  out of Find Item automatically.
- **`docs/plans/repel-family-threat-shield.md`** — **Repel/Max Repel stop being
  catch-steering** and become New-Experience threat-avoidance items (skip the next N
  adventure threats); it also deletes the type-bias "away" branch. So Repel/Max Repel
  are **no longer coverage tools** — treat them as ordinary findable gadgets here.

The endgame-rebalance plan's "you must build type advantage" bet leans on type
coverage being reachable; Phase 1 here (concentrating Find Item onto gadgets like
Poke Radar) and the Honey plan (buyable Honey) are what make that true.

## Decisions locked (2026-07-22 session — recorded so they aren't re-litigated)

- **Q2 — Loss stakes → no new system; the lever is potion availability.** A "second
  wind" mechanic was rejected (potions already *are* the in-battle retry, up to 3 via
  Hyper; runs are ~5–10 min). If loss-feel needs tuning, the lever is potion
  availability / retry counts — which is exactly what the **Phase 3 stock system**
  implements (a fixed per-run potion supply), so loss-stakes tuning happens there via
  the caps, not a new mechanic.
- **Q4 — Threats → keep them no-choice, fix only the Toll Booth economy coupling.**
  The Danger meter only works if threats bite; a spend-to-reroll would dilute the
  tension engine. The one genuine defect is Toll Booth punishing you for being
  coin-poor right after the game told you to spend at the Market (Phase 4).
- **R2 — Toll Booth: keep it a threat, don't turn it into a battle.** Phase 4's locked
  path is the low-risk one — **keep the flat toll + shortfall spike, cut the spike cap
  15→5.** This preserves the Q4 guardrail while removing the market-spending trap's
  teeth. The "% coin sink, no spike" variant is demoted to the alternative. A floated
  "Toll Booth becomes an avoidable mini-battle" idea was rejected (reopens Q4's
  no-choice rule, doesn't fix the trap unless winning waives the toll, real scope) →
  filed in `docs/todo/backlog.md` as a separate threat-variety idea.
- **Stock system (Phase 3) — fixed per-run stock + very expensive, escalating, capped
  paid restock.** Chosen with the owner over auto-refill-per-round and over a free
  reward-card restock: scarcity by default, with a costly Market restock as the
  guaranteed relief valve (so no pure-RNG brick-the-run failure mode) and a real coin
  sink. Numbers in Phase 3.

Checkpoint after each phase — do not run several in one stretch.

---

## Phase 1 — Find Item ↔ Market disjoint inventories

**Why:** the Find Item card (reward-pool weight 2) rolls all 14 regular items,
~47% of which (by weight) are the seven items the Market already sells on demand
(the six consumables **plus Bicycle**, added to the Market in PR #47) — so a Find
Item pick can feel like a dud, and the player can't steer toward the find-only
gadgets that are the card's real value. Disjoint inventories mean Find Item
**always** hands you something the Market never stocks.

**Synergy with the endgame-rebalance plan:** the find-only gadgets include the
*type-steering* tool `poke-radar` (the hard-guarantee route) that lets a player build
the type advantage the endgame-rebalance plan now rewards more. Concentrating Find
Item onto gadgets makes hitting that card more likely to yield it — so this phase
quietly supports the "you must build advantage" bet, not just declutters the wheel.
**Sibling-plan notes:** `honey` becomes *buyable* via `honey-target-share-market.md`,
so once that ships it leaves the findable set automatically (the exclusion is derived
from Market stock). `repel`/`max-repel` stay findable but are being repurposed to
threat-avoidance by `repel-family-threat-shield.md` — no longer coverage tools, just
other gadgets on the wheel.

**Current system:**
- `FindItemRouletteComponent`
  (`.../roulettes/find-item-roulette/find-item-roulette.component.ts:31`) builds its
  wheel from `ItemsService.getRegularItems()` (all 14, minus Revive in Classic).
- Market stock (`market.component.ts:156`) = `potion, super-potion, hyper-potion,
  x-attack, rare-candy, revive, bicycle` + random capsule.

**Change (New Experience only; Classic unchanged — it has no Market):**
- [ ] Add `ItemsService.getFindableItems()`: in New Experience, return
  `getRegularItems()` filtered to exclude the Market-sold item names (the six
  consumables **and `bicycle`**), leaving the gadgets (`exp-share, escape-rope,
  honey, repel, poke-radar, max-repel, link-cable`). In Classic, return
  `getRegularItems()` unchanged. Keep the exclusion list derived from the Market
  stock so the two can't silently drift apart if the Market changes again.
- [ ] Point `FindItemRouletteComponent`'s constructor at `getFindableItems()`.
- [ ] Update `find-item-roulette.component.spec.ts` and any `items.service.spec.ts`
  assertion. `npm run test:local` green. Checkpoint.

**Acceptance:** in New Experience, the Find Item wheel never shows a Market
consumable; in Classic, the wheel is identical to today.

---

## Phase 2 — Sell-for-coins (close the economy loop)

**Why:** there is no way to turn an item into coins. A bias item found with a full,
settled team is pure dead weight — and after Phase 1 the Find Item card *only* hands
out gadgets, so a full-team player finding one gets nothing. A sell action makes
every item at least *something* and gives the economy a second, player-driven
faucet. (No arbitrage: you buy high and sell low, and items aren't a coin faucet —
confirm sell value < buy price.)

**Not here:** making Honey buyable is owned by `honey-target-share-market.md`, not
this phase — don't add it in the Market here.

**Current system:**
- `TrainerService.removeItem(item)` (`trainer.service.ts:469`), `addCoins()`
  (`:533`), `spendCoins()` (`:540`), `getCoinsObservable()` — all already persisted
  by `RunPersistenceService`.
- `MarketComponent` already gates on `isNewExperienceMode` + `isAvailable` (closed
  during combat/prep).

**Change (New Experience only):**
- [ ] Add `SELL_RATE = 0.4` and `GADGET_SELL_VALUE = 5` (coins) to
  `economy-config.ts`, plus `sellValue(itemName)`: Market consumables →
  `floor(MARKET_PRICES[id] × SELL_RATE)`; gadgets → `GADGET_SELL_VALUE`.
  Recommendation baked in: ability capsules sellable at `floor(35 × SELL_RATE)=14`
  (capsule price is 35 as of PR #47); mega stones **not** sellable (build pieces).
- [ ] Add a "Sell" section to the Market modal listing held sellable items (dedup
  by name with a count), each with a sell button → `removeItem` +
  `addCoins(sellValue)`. Reuse the affordable/disabled styling and the
  combat-lockout (`isAvailable`) so a sale can't react to a shown loss.
- [ ] `market.component.spec.ts` cases (sell removes item + credits coins; disabled
  in combat). `npm run test:local` green. Checkpoint.

**Acceptance:** selling a Potion (price 25 as of PR #47) yields `floor(25×0.4)=10`
coins and removes it; selling is unavailable during a battle spin / committed prep.

---

## Phase 3 — Market stock system (fixed per-run stock + capped paid restock)

**Why:** the Market has **infinite stock** today — `buy()` spends coins and bags the
item but never depletes anything (`market.component.ts:138`), so coins barely
constrain you and "buy 3 Hyper Potions before every fight = 3 free retries"
trivialises the loss-stakes the game leaves to *potion availability* (decision Q2). A
stock system caps how much you can hold, turning each purchase into a decision and
making the coin sinks (Toll Booth) and the Phase 2 sell faucet matter.

**Design (locked with owner — "fixed per run, refill only via a very expensive,
escalating, capped Market restock"):**
- Each Market entry has a **per-run capacity** `MARKET_STOCK[id]`. You **start at
  capacity**; buying decrements; **stock does NOT auto-refill** on round advance
  (this is the scarcity — unlike a per-round budget).
- The **only** way to replenish is a **paid "Restock" action in the Market**. It
  refills every *restockable* entry back to capacity (never above — capacity is a hard
  ceiling). It is deliberately an **emergency valve, not a spam button**:
  - **Very expensive & escalating:** `restockPrice(n) = RESTOCK_BASE + RESTOCK_STEP ×
    n`, where `n = timesRestockedThisRun`. Recommended `RESTOCK_BASE = 60`,
    `RESTOCK_STEP = 40` → **60 → 100 → 140**. One emergency refill is affordable;
    leaning on it every fight bankrupts you (a real coin sink, complementing Toll
    Booth and the Phase 2 sell faucet).
  - **Hard cap per run:** `RESTOCK_MAX_USES = 3`. After the cap the Restock row is
    disabled ("No restocks left"). So total buyable over a run is bounded:
    `capacity + RESTOCK_MAX_USES × (capacity consumed)` — genuinely scarce.
- **Bicycle is excluded from restock** (one-time gadget): capacity 1, and once bought
  it stays sold-out for the run (restock never re-grants it).
- New-Experience only (Classic has no Market/coins). Restock is a Market row, so it's
  gated by the Market's existing `isNewExperienceMode` + `isAvailable` (closed during
  combat/committed prep) — a restock can't react to a shown loss, same as any buy.

**Recommended values (baked in, owner confirms in 3a — flag if any feel off):**
```
MARKET_STOCK      = { potion:5, super-potion:3, hyper-potion:2, x-attack:3,
                      rare-candy:2, revive:2, ability-capsule:2, bicycle:1 }
RESTOCK_BASE = 60   RESTOCK_STEP = 40   RESTOCK_MAX_USES = 3   // → 60/100/140, max 3×
```
(If `honey-target-share-market.md` has shipped, it adds `honey` to the Market — give
it a `MARKET_STOCK['honey']`, recommend 3; the two plans coordinate on the key set.)

**Loss-stakes tie-in (Q2):** this *is* the "potion availability" lever the game leaves
for loss-feel. Caps must stay generous enough that the endgame isn't unwinnable, and
the paid restock is the guaranteed (if costly) relief valve so there's no pure-RNG
brick-the-run failure mode. Both the caps and the restock price/cap are 3a
owner-confirms.

**Current system (read before touching code):**
- `MarketComponent` (`market.component.ts`): `stock: MarketEntry[]` rebuilt each
  `ngOnInit` via `buildStock` (`:155`); `buy(entry)` (`:138`) = `spendCoins` +
  `addToItems`, no depletion; `canAfford(entry)` (`:134`) gates the button; the modal
  already gates on `isNewExperienceMode` + `isAvailable` (`:104`,`:113`). Prices in
  `MARKET_PRICES` / `MarketEntryId` (`economy-config.ts:56`).
- Persistence (`run-persistence.service.ts`): a single `combineLatest` over service
  observables (`:79`) fires on any mutation → `persistRun(...)` (`:104`); restored in
  `restoreRun` before first render. **Any new persistent run state joins that
  `combineLatest` + the `persistRun` payload** (fairness invariant — a reload must not
  refresh stock **or** reset the restock counter).

**Sub-phases:**
- [ ] **3a — `MarketStockService` + config + persistence (engine only).** New root
  service `src/app/services/market-stock-service/market-stock.service.ts` holding a
  `BehaviorSubject` of `{ remaining: Record<MarketEntryId, number>; timesRestocked:
  number }`. Methods: `getStateObservable()`, `getRemaining(id)`, `consume(id)`
  (decrement, guard > 0), `restockAll()` (each restockable id → `cap[id]`; skip
  `bicycle`; increment `timesRestocked`), `restockPrice()` (`RESTOCK_BASE +
  RESTOCK_STEP × timesRestocked`), `canRestock()` (`timesRestocked < RESTOCK_MAX_USES`),
  `resetForNewRun()` (all ids → cap, `timesRestocked = 0`), `restore(record)` (merge
  persisted `remaining` over the caps so a missing key defaults to cap; restore
  `timesRestocked ?? 0`). Add `MARKET_STOCK`, `RESTOCK_BASE`, `RESTOCK_STEP`,
  `RESTOCK_MAX_USES` to `economy-config.ts`. Wire persistence: add
  `marketStockService.getStateObservable()` to the `combineLatest` (`:79`); add
  `marketStock` (the `{ remaining, timesRestocked }` snapshot) to the `persistRun`
  payload (`:104`) and `PersistedRun`; restore in `restoreRun`; add a validation
  clause. Hook `resetForNewRun()` into the same new-run path the other services reset
  from. **Specs:** consume decrements & floors at 0; `restockAll` refills to cap
  (never above), skips bicycle, and increments the counter; `restockPrice` escalates
  60/100/140; `canRestock` false after 3; `marketStock` round-trips through
  persistence and missing fields restore to caps / 0. **Stop for owner to confirm the
  caps + restock price/cap.** Checkpoint.
- [ ] **3b — Market UI: deplete on buy, sold-out state, + paid Restock row.**
  `MarketComponent`: inject `MarketStockService`, subscribe to `getStateObservable()`
  into a `remaining` map + `timesRestocked`. In `buy()` call
  `marketStockService.consume(entry.id)` after the successful `spendCoins`/`addToItems`;
  add `canBuy(entry) = canAfford(entry) && remaining[id] > 0`; template shows the
  remaining count per row and a disabled **"Sold out"** state at 0 (reuse the
  affordable/disabled styling). Add a distinct **Restock** control (a footer row, not a
  per-item entry) showing the current `restockPrice()`; `onRestock()` = guard
  `isAvailable` + `canRestock()` + `coins >= restockPrice()`, then
  `spendCoins(restockPrice())` and `marketStockService.restockAll()`, with a brief
  confirm modal. Disable it (with "No restocks left") when `!canRestock()`, and grey it
  when unaffordable. i18n: `market.soldOut`, `market.stockLeft` (count param),
  `market.restock` (price param), `market.restockExhausted`, and the confirm copy —
  all six locales. **Spec** (`market.component.spec.ts`): buying to 0 disables the row;
  buying decrements the service; sold-out persists across reopen; restock spends the
  escalating price + refills to cap; restock disabled after `RESTOCK_MAX_USES` and when
  unaffordable / during combat. Checkpoint.

**Acceptance:**
- Start a run → buy 5 Potions → the 6th is "Sold out"; clearing a round does **not**
  refill it.
- Restock #1 costs 60 → all consumables back to capacity (Bicycle **not** re-granted),
  Potions = 5 again; the Restock price now reads 100, then 140; after the 3rd it shows
  "No restocks left" and is disabled.
- Reload after buying 3 Potions and 1 restock → still 2 Potions remaining and
  `timesRestocked = 1` (price still 100) — reload refreshes nothing. Classic → no stock
  limits, no Restock row.

---

## Phase 4 — Toll Booth: soften the market-spending trap (keep it a threat)

**Why:** the game pushes you to spend coins at the Market, then the Toll Booth
threat (`roulette-container.component.ts:1035`) charges a fixed `15 + 3×round` and
**spikes the Danger meter** scaled to the unpaid fraction when you're short — so
spending as intended is exactly what exposes you. **R2 decision:** fix the *bite*,
not the whole mechanic — keep Toll Booth a real threat (honours the Q4 "threats must
bite" guardrail) but cut its spike so a spender can't be gutted.

**Current system:**
- `tollAmount(round) = 15 + 3*round` (`:1025`); `tollBooth()` pays `min(balance,
  toll)` then, if short, `applySpike(5|10|15)` by unpaid fraction (`:1043`).
- `excludedThreatIds()` (`:916`) already filters no-op threats (e.g. `pcLockout`
  when `total <= 1`).

**Change — locked (R2): keep the threat, cut the spike.**
- [ ] Keep `tollAmount(round) = 15 + 3*round` and the `min(balance, toll)` payment
  unchanged. In the shortfall branch (`:1046`), **cut the spike cap from 15 to 5** —
  i.e. `spike = unpaidFraction <= 1/3 ? 2 : unpaidFraction <= 2/3 ? 3 : 5` (or the
  simplest equivalent that tops out at 5). A short player still feels a nudge, but a
  full shortfall can no longer gut a run.
- [ ] Update the `tollBooth` modal copy so the shortfall message reflects the smaller
  bite (no other copy path changes), and update the toll spec's spike expectations.
  `npm run test:local` green. Checkpoint.

**Design-guardrail note:** this **preserves** the `threat-mechanics-expansion.md`
rule "being short must never be a costless no-op" (Toll Booth still bites when you're
short) and the Q4 "Danger meter only works if threats bite" principle — it only
lowers the ceiling. No guardrail reversal, so no special release-notes carve-out
needed beyond noting the softer spike.

**Alternative (rejected here, recorded for context):** make the toll a percentage of
current coins (`max(5, ceil(coins × 0.4))`) and remove the spike entirely — cleanest
"you can't be short" fix, but it turns Toll Booth into a **pure coin sink** and
deletes it from the Danger/threat pool, reversing the Q4 guardrail. Not chosen.

**Backlog (not this plan):** a floated idea — *Toll Booth becomes an avoidable
mini-battle, effect only on loss* — is a threat-**variety** concept, not a fix for
this trap (it reopens Q4's no-choice rule and doesn't remove the trap unless winning
waives the toll). Filed in `docs/todo/backlog.md` for separate design, out of scope
here.

---

## Phase 5 — Potion text fix (legibility)

**Why:** `items.{potion,super-potion,hyper-potion}.description` still say "whenever
you would lose a **Gym** battle," but retries apply to every battle type now — the
wording makes players undervalue the most important consumable. (Extra relevant once
Phase 3 makes potions a scarce, capped resource — the description should not
mislead about when they help.)

- [ ] Reword the three descriptions to "any battle" (or equivalent) in
  `src/assets/i18n/en.json` (real) and the other five locale files (`de, es, fr, it,
  pt` — translated where practical, English placeholder otherwise). No code change.
  Checkpoint.

---

## Phase 6 — Docs, version, release notes

- [ ] **README `Economy & the Market` section** — Find Item now disjoint from the
  Market; sell-for-coins; the Market stock system (finite per-run stock + a costly,
  capped restock); Toll Booth's shortfall spike softened (cap 15→5, still a threat).
  (Honey-in-Market is documented by `honey-target-share-market.md`.)
- [ ] Bump `package.json` `version` (confirm current first) and add a newest-first
  `RELEASE_NOTES` entry (`src/app/data/release-notes.ts`) with
  `whatsNew.v<x>_<y>_<z>.*` keys + a `v<x>_<y>_<z>` label in **all six** locale
  files (`en` real, others English placeholder). Call out: Find Item no longer dumps
  Market items; you can sell items for coins; the Market now has limited stock with a
  costly restock; the softer Toll Booth spike.
- [ ] **If this ships in the same release as `endgame-rebalance.md`** (or the Honey /
  Repel plans), fold all into one What's-New entry / one version bump rather than
  bumping multiple times — coordinate whichever plan lands second.
- [ ] Move this plan file to `docs/plans/done/` once all phases complete.

---

## Acceptance tests (input → expected)

1. **Find Item disjoint (Phase 1).** After Phase 1, New Experience → wheel contains
   only `exp-share, escape-rope, honey, repel, poke-radar, max-repel, link-cable`; no
   Market-sold item (including no Bicycle). Classic → unchanged. **Cross-plan:** once
   `honey-target-share-market.md` makes Honey Market-sold, the same Market-derived
   exclusion drops `honey` too (→ `exp-share, escape-rope, repel, poke-radar,
   max-repel, link-cable`); whichever of the two plans ships second re-runs this
   assertion.
2. **Sell (Phase 2).** Hold a Potion, coins = C → sell → coins = `C + 10`, Potion
   gone. During committed prep → Sell buttons disabled.
3. **Market stock (Phase 3).** Buy 5 Potions (cap) → 6th is "Sold out"; clearing a
   round does **not** refill it. Restock #1 costs 60 → all consumables back to cap
   (Bicycle not re-granted); price then reads 100, 140; after the 3rd → "No restocks
   left", disabled. Reload after buying 3 Potions + 1 restock → still 2 Potions and
   `timesRestocked = 1` (price 100). Classic → no stock limits, no Restock row.
4. **Toll Booth (Phase 4).** At `round=8` toll = `15+3×8 = 39`. With coins = 100 →
   pay 39, coins → 61, no shortfall so no spike. With coins = 10 → pay 10, unpaid
   fraction ≈ 0.74 → spike = **5** (was capped at 15). The toll still fires and still
   bites when short — only the ceiling dropped.
5. **Potion text (Phase 5).** `items.potion.description` no longer contains "Gym"
   in `en.json`.
6. **Full suite green** after every phase's spec updates.

## Risks

- **Market stock persistence** (Phase 3) — if the `marketStock` snapshot
  (`remaining` **and** `timesRestocked`) isn't wired into the `combineLatest`/
  `persistRun` path, a reload would refresh stock or reset the restock price/cap (an
  exploit breaking the fairness invariant). It **must** persist like coins; 3a's spec
  covers the round-trip.
- **Restock pricing is load-bearing** (Phase 3) — the escalating price + `MAX_USES`
  cap are what preserve scarcity; too cheap and the paid restock reverts to the
  per-round-budget model that was rejected, too steep and it stops being a usable
  relief valve. Owner-confirmed in 3a; tune from playtest. Caps are also the Q2
  "potion availability" loss-feel lever — keep them generous.
- **Toll Booth** (Phase 4) — R2 keeps the threat and only cuts the spike cap
  (15→5), so **no guardrail reversal** and no special carve-out; just note the softer
  bite in release notes.
- **Sell arbitrage** — none as designed (buy high / sell low); confirm `sellValue <
  buy price` for every sellable item.
