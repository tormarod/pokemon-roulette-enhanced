# Plan: Endgame rebalance & ability-magnitude parity

Status: **Not started.**
Owner: tormarod
Last updated: 2026-07-22 (split out of the former `game-design-holistic-review.md`)

> One of two plans carved from the 2026-07-22 holistic review. **This plan is the
> battle-math half** (amplify agency in the back half). The economy half — Find Item
> disjoint, sell-for-coins, Market stock system, Toll Booth, potion text — lives in
> `docs/plans/economy-market-reconciliation.md` and is **fully independent** of this
> one (disjoint file sets, no cross-dependency; ship in either order or in parallel).
> This plan absorbs the former `round-threat-rebalance.md` (deleted) — its endgame
> two-lever rebalance is Phase 1 here.

## Why (the diagnosis)

**The agency superstructure sits on a power economy too compressed to feel it.** The
game keeps adding informed-choice systems — symmetric type matchup, opponent preview,
mandatory lead pick, a 30-ability roster, a coin Market — but base power caps at 5
(most final evolutions are 3), so a full team tops out at ~19 Yes tickets. Meanwhile
No tickets grow unbounded with `round` (`ceil(round × 1.5)` → 18 by the Champion). The
sum of *every* decision the player can make is on the order of ±10 tickets against a
No pool near 19 — so the back half is a coin flip the player can barely influence.
Audited numbers (2026-07-20, 6× power-3 team, base No = 1, only the round rising):

```
round  0: green=19 red= 1  yesShare=95.0%
round  4: green=19 red= 7  yesShare=73.1%
round  8: green=19 red=13  yesShare=59.4%
round 12: green=19 red=19  yesShare=50.0%   ← champion
```

The wheel is honest — this is a *balance* problem, addressed by **Phase 1** (lower the
round multiplier + reward type-countering more). **Phase 2** then re-checks that
abilities still matter once the matchup unit is bigger.

## Decisions locked (2026-07-22 session — recorded so they aren't re-litigated)

- **Q1 — Endgame coin-flip → amplify the choice levers + flatten the round ramp
  (Phase 1).** Two levers (see Phase 1). Locked values: **Lever A `ROUND_THREAT_MULT`
  = 1.25** (from 1.5) and **Lever B matchup unit = symmetric `ceil(power/2)`** (from
  `ceil(power/4)`). We do **not** rescale raw Pokémon power (rejected: editing power on
  1025 mons + every downstream number is high blast radius for a cosmetic gain over
  what the levers already achieve).
- **Q3 — "Dead" late catches → no active work (deferred to backlog).** The PC bench is
  *not* dead weight: with the opponent preview + matchup system, catches 7–10 buy type
  coverage you swap in per fight, and that gets **more** valuable once Phase 1
  amplifies the matchup unit. The 3-pick adventure draw already lets a player skip an
  unwanted catch. Re-evaluate late-catch feel only *after* Phase 1 ships (backlog note)
  rather than engineering a fix for a non-problem now.

### Refinements (2026-07-22 follow-up — attainability review)

- **R1 — Symmetric `/2` stays; a purchasable coverage lever comes from a sibling
  plan.** Type advantage *is* a reliable build target, so punishing "wrong types"
  symmetrically is honest: the endgame themes are **single-type** (Gen 1: Ice →
  Fighting → Ghost → Dragon → Normal — `elite-four-by-generation.ts:12-40`,
  `champion-by-generation.ts:13`), the opponent is previewed, catches are
  **type-steerable** (`apply-type-bias.ts`: Honey biases *toward* a type, Poke Radar
  hard-filters to *guarantee* one), and the PC bench + mandatory lead pick let you swap
  the counter in. **The one gap:** the steering tools are Find-Item-only, not buyable —
  but that's **already being closed by `docs/plans/honey-target-share-market.md`**
  (Honey reworked to a ~55% target-share bias **and sold in the Market**), while Poke
  Radar stays the found-only guaranteed route. So coverage is a genuine, reachable
  build target. We do **not** switch to an asymmetric reward-only unit (rejected: extra
  branching on netScore sign, and it would break the "delta depends only on the
  Pokémon" purity + the display strip that shows both sides).
- **R3 — Phase 1a models the netScore tails, not just netScore = 2.** Endgame
  opponents are single-type, but a dual-type counter still reaches netScore ~±4–6 (each
  of the member's two types scores up to ±3 per opponent type —
  `type-matchup.service.ts:56-73`), and doubling the unit compounds that tail both
  ways. 1a logs a **high** and a **low** netScore matchup and adds a **`/3` middle
  column** alongside `/4` and `/2`, so we see the tails and confirm 2× is the right
  magnitude before locking.

Checkpoint after each phase — do not run both in one stretch.

---

## Phase 1 — Endgame rebalance: ease round-threat + reward type advantage

**Why (two independent roots):**
1. **No grows unbounded** with `round` while Yes has a hard ceiling. → **Lever A**
   lowers `ROUND_THREAT_MULT` so late battles stay hard but aren't coin-flips.
2. **The reward for good team-building is too small.** A power-3 Water-vs-Fire mon
   contributes only `netScore(2) × ceil(3/4)=1 = +2` Yes tickets — barely more than
   a neutral pick. → **Lever B** doubles the per-Pokémon matchup unit so a
   thoughtfully-countered team is meaningfully favored, without touching the
   neutral case at all.

Design intent: keep the core RNG intact (you build your odds, the wheel decides),
but make *player choices* matter more than raw progress. Lever A is flat relief for
everyone; Lever B is pure agency (only rewards countering the opponent).

**The two levers:**
- **Lever A — `ROUND_THREAT_MULT`.** Exported constant in
  `src/app/services/battle-odds-service/battle-odds.service.ts:7`, used once in
  `computeOdds` (~line 83): `Math.ceil(currentRound * ROUND_THREAT_MULT)`, folded
  into `rawNo`. `currentRound = leadersDefeatedAmount` (gyms 0–7, elite four 8–11,
  champion 12 in an 8-gym generation). **Set to 1.25.**
- **Lever B — the per-Pokémon matchup unit `getMemberDelta`**
  (`src/app/services/type-matchup-service/type-matchup.service.ts:37`), currently
  `Math.ceil(member.power / 4)`. **Change to `Math.ceil(member.power / 2)`.**
  Change the unit *at the source*, not as an odds-only multiplier: the same unit
  feeds both the wheel odds **and** the number shown in the battle-prep lead picker
  / matchup strip. A scaler applied only inside `computeOdds` would make the shown
  "+2" understate its real effect, breaking the battle-odds-transparency "no drift"
  invariant. The documented invariant "delta depends only on the Pokémon, never
  team composition" is preserved — still a pure function of the member.

**Locked-decision rationale (baked in above):**
- **Lever A = 1.25** — conservative flat ease that lifts the neutral Champion off
  the coin flip (47.5% → 51.4%) without carrying well-built teams too far once
  Lever B is also in. (1.0 pushes an advantaged Champion to ~74% — may feel soft.)
- **Lever B = symmetric** — doubling `getMemberDelta` doubles **both** the
  advantage bonus and the disadvantage penalty (both sides multiply the same unit).
  Kept symmetric: it's the clean one-line change, preserves the display/odds
  invariant and the symmetric-scoring design
  (`docs/plans/done/type-matchup-symmetric-scoring.md`), and "bringing the wrong
  types is punished harder" is honest agency. Cost: a hard-countered team gets
  *worse* (Champion mismatch 36.5% → 31.1%). A **neutral** team is unaffected.

**Projected odds (computed, reproducible).** All at the **Champion**:
`baseNoCount 3`, `round 12`, 6× power-3 team. Neutral = no type edge (yesTickets
19). Advantaged = Water vs Fire (each member netScore 2).

| variant | roundThreat | neutral win | advantaged win |
|---|---|---|---|
| today (mult 1.5, unit /4) | 18 | 19/40 = **47.5%** | 31/52 = **59.6%** |
| Lever A only (1.25, /4) | 15 | 19/37 = **51.4%** | 31/49 = **63.3%** |
| Lever B only (1.5, /2) | 18 | 19/40 = **47.5%** | 43/64 = **67.2%** |
| **combined (1.25, /2)** | 15 | 19/37 = **51.4%** | 43/61 = **70.5%** |

Neutral only moves with Lever A; Lever B is pure agency. Advantaged yesTickets rise
from 31 (`18 + 6×2`) to 43 (`18 + 6×4`).

**Whole endgame gauntlet — Elite Four (r8–r11) + Champion (r12), single-spin, no
retries:**

| team | today (1.5, /4) | combined (1.25, /2) | relative |
|---|---|---|---|
| neutral | ~3.9% | ~5.5% | +40% |
| advantaged | ~10.9% | ~22.5% | +106% |

Headline: each single late battle rises only a few points, but the chance of
clearing the whole endgame roughly **doubles for a well-built team** while a random
team barely moves. Early game barely moves: gym round 2 → `ceil(2×1.25)=3` =
today's `ceil(2×1.5)=3`.

**Current system (read before touching code):**
- Lever A: `ROUND_THREAT_MULT` — single definition/use; grep to confirm
  before/after.
- Lever B: `getMemberDelta` feeds `getMemberSignedDelta` → `calcTeamMatchupTotals`
  → `BattleOddsService.computeOdds` (Yes advantage, No disadvantage); the
  battle-prep lead badge (`battle-prep-panel.component.html:21-24` calls
  `getMemberDelta` directly); and the matchup-strip totals
  (`matchupAdvantageDelta`/`matchupDisadvantageDelta` in
  `base-battle-roulette.component.ts`). Bigger numbers post-change are intended
  (more legible lead choice) — sanity-check the render.
- **Specs hard-coding the current numbers** (re-grep, don't trust as exhaustive):
  - Lever A: `grep -rn "1\.5\|threatMult\|round.*1\.5" src/app --include=*.spec.ts`
    — known: `base-battle-roulette.component.spec.ts`,
    `gym-battle-roulette.component.spec.ts`,
    `elite-four-battle-roulette.component.spec.ts` (champion/rival specs may add
    cases).
  - Lever B: `grep -rn "getMemberDelta\|power / 4\|ceil(.*power" src/app --include=*.spec.ts`
    — known: `type-matchup.service.spec.ts` (many), `battle-prep-panel.component.spec.ts`,
    `ability.service.spec.ts`, `gym-battle-roulette.component.spec.ts`. These specs
    write the arithmetic in their comments, so each failure is self-documenting.

  **New unit reference — `getMemberDelta = ceil(power/2)`:**
  ```
  power:  1  2  3  4  5  6  7  8
  old /4: 1  1  1  1  2  2  2  2
  new /2: 1  1  2  2  3  3  4  4     ← powers 1–2 unchanged; 3+ increases
  ```
  So a power-3 netScore-2 contribution becomes `2×2=4` (was 2); power-5 netScore-2
  becomes `2×3=6` (was 4). Any assertion using a power-1/2 member keeps its number.

**Sub-phases:**
- [ ] **1a — Confirm the tables (no product change yet).** With a throwaway spec in
  `.../base-battle-roulette/` (reuse the `TestBattleRouletteComponent` pattern),
  drive `computeOdds`/`buildVictoryOdds` for 6× power-3 teams across rounds 8–12 at
  each combination (`mult ∈ {1.5,1.25,1.0}` × `unit ∈ {/4,/3,/2}` — **note the `/3`
  middle column, R3**), logging `yesTickets/noTickets/winShare` and the gauntlet
  product. Run **three matchup profiles, not just neutral vs the tidy netScore-2
  case (R3):**
  - **neutral** — no type edge (netScore 0);
  - **advantaged (mild)** — the netScore-2 single-type case in the tables above;
  - **advantaged (high)** — a dual-type counter reaching netScore ~+4–6, to see the
    doubled-unit **upside tail** (does a well-countered fight over-trivialise?);
  - **mismatched (low)** — netScore ~−4–6, to see the **downside tail** (how brutal
    the symmetric penalty gets on a bad dual-type matchup).

  Reproduce the two tables above for the mild rows, and post the tail rows too.
  **Stop for the owner to confirm 1.25 + symmetric `/2`** (or pick `/3`, or different
  values — only the constants + "chosen" rows change, the phase structure is
  identical). Delete the throwaway spec.
- [ ] **1b — Lever A: lower `ROUND_THREAT_MULT`** to 1.25 in
  `battle-odds.service.ts:7`. Update every Lever-A spec to the new `ceil(round ×
  1.25)` expectations, keeping comments accurate. `npm run test:local` green.
  Checkpoint.
- [ ] **1c — Lever B: double the matchup unit.** Change `getMemberDelta` to
  `Math.ceil(member.power / 2)`; update its doc-comment ("quarter" → "half"). Run
  the suite; every failing type-matchup / prep-panel / ability / gym assertion is a
  hard-coded old-unit number — recompute with the table above and fix the inline
  comment. Manually sanity-check the lead badge + matchup strip. Green. Checkpoint.

---

## Phase 2 — Ability magnitude parity pass (measure, then tune)

**Why:** after Phase 1 doubles the matchup unit, a flat `+1..3` ability
(`abilities-data.ts`) is a smaller share of a bigger swing, so the elaborate
build-toward-abilities loop risks feeling pointless. This phase checks that and
bumps magnitudes only if warranted — deliberately conservative so Phase 1 + Phase 2
don't stack into over-easing.

**Current system:**
- `AbilityService.applyTeamAbilities()`
  (`src/app/services/ability-service/ability.service.ts:39`) folds each member's
  ability into `{yesBonus, noBonus, extraRetry}`; consumed by `computeOdds`
  (`abilityYes`/`abilityNo`).
- Magnitudes live in `abilitiesById`
  (`src/app/services/ability-service/abilities-data.ts:96`) via `value`. Flat/
  conditional effects are `1–3`; `scale-with-*` use `value` as a cap; `extra-retry`
  / `faint-immune-lead` / `zero-own-negative` ignore `value`.

**Sub-phases:**
- [ ] **2a — Measure.** Throwaway spec (delete after) in `.../ability-service/`
  that, at the Phase-1 unit (`ceil(power/2)`), logs each ability's ticket impact on
  a representative team (6× power-3) vs one matchup point (`ceil(3/2)=2` per
  net-score point). Report the table. **Stop for the owner to lock a target
  parity** (recommendation: a strong ability ≈ one favourable matchup point, ~2–4
  tickets, not 1).
- [ ] **2b — Apply locked values.** Bump the flat magnitudes toward the target
  (starting recommendation, pending 2a: `flat`/`offense-if-positive` `1→2`, `2→3`;
  keep No shifts symmetric; raise `scale-with-*` caps `3→4`). Update
  `ability.service.spec.ts`. `npm run test:local` green. Checkpoint.

**Note (not in scope):** `team-synergy` (`synchronize`, +value Yes per same-type
teammate) rewards mono-type stacking, which pulls against type coverage. Treated as
a legitimate high-risk build choice, **not** a bug — see backlog if degenerate in
playtest.

---

## Phase 3 — Docs, version, release notes

- [ ] **README `Battle balancing` section** — state the new `ROUND_THREAT_MULT`
  (1.25) **and** the new matchup unit (`ceil(power/2)`) + intent (endgame stays
  hard but not a coin flip; type-countering the opponent now pays off more).
- [ ] Bump `package.json` `version` (confirm current first) and add a newest-first
  `RELEASE_NOTES` entry (`src/app/data/release-notes.ts`) with
  `whatsNew.v<x>_<y>_<z>.*` keys + a `v<x>_<y>_<z>` label in **all six** locale
  files (`en` real, others English placeholder). Call out: late-game less punishing
  + type-countering rewarded more (Phase 1); the symmetric penalty makes mismatched
  teams harder; and (if shipped) the ability bump.
- [ ] **If this ships in the same release as `economy-market-reconciliation.md`**,
  fold both into one What's-New entry / one version bump rather than bumping twice —
  coordinate whichever plan lands second.
- [ ] Move this plan file to `docs/plans/done/` once all phases complete.

---

## Acceptance tests (input → expected)

1. **Champion neutral (Phase 1).** 6× power-3, no edge, `baseNoCount=3`, `round=12`
   → `yesTickets=19`, `noTickets = 3 + ceil(12×1.25) = 18`, winShare ≈ **51.4%**
   (was 47.5%). Confirms Lever A moved it, Lever B did not.
2. **Champion advantaged (Phase 1).** Water vs Fire → `yesTickets = 18 +
   6×(2×ceil(3/2)) = 43`, `noTickets = 18`, winShare ≈ **70.5%** (was 59.6%).
3. **Champion mismatched (Phase 1).** Fire vs Water → `yesTickets=19`, `noTickets =
   3 + 15 + 6×(2×ceil(3/2)) = 42`, winShare ≈ **31.1%** (was 36.5%) — confirms the
   symmetric penalty.
4. **Early game barely moves (Phase 1).** Gym round 2 → `roundThreat = ceil(2×1.25)
   = 3`, identical to today's `ceil(2×1.5)=3`.
5. **Powers 1–2 unchanged by Lever B.** `getMemberDelta(1)=1`, `(2)=1` before and
   after. **Floor intact:** round-0 battle still yields `noTickets = baseNoCount`.
6. **Abilities (Phase 2, if bumped).** A `flat-yes` ability's `value` matches the
   locked target; `ability.service.spec.ts` recomputed and green.
7. **Full suite green** after every phase's spec updates.

## Risks

- **Wide Lever-B spec blast radius (Phase 1c).** Changing the matchup unit ripples
  through all of `type-matchup.service.spec.ts` and several component specs. Run the
  greps first; lean on the self-documenting comment arithmetic; fix every failure
  mechanically. That's why Lever B is isolated in its own sub-phase.
- **Display drift** if Lever B were an odds-only multiplier — don't; change
  `getMemberDelta` at the source.
- **Over-easing (Phase 1 + Phase 2 stack).** Measure abilities *after* Phase 1's
  doubled unit; keep the bump conservative and gated on the 2a table. Combined
  1.0 + /2 pushes an advantaged Champion to ~74% — 1.25 is the conservative pick.
- **Symmetric penalty makes bad matchups worse** (test 3) — intended agency, but a
  player-facing difficulty change; release-notes callout required.
