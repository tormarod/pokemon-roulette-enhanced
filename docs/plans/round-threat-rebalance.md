# Plan: Rebalance late-game battles — ease round-threat + reward type advantage

Status: **Not started.**
Owner: tormarod
Last updated: 2026-07-20

## Why

Battle No tickets grow with **progress**, not team strength. Each battle adds
`ceil(currentRound × ROUND_THREAT_MULT)` crimson slices (`ROUND_THREAT_MULT = 1.5`),
where `currentRound = leadersDefeatedAmount` climbs to ~12 by the Champion. Yes
tickets, by contrast, are capped by tiny power values (dex maxes at power 5; most
final evolutions are 3 — a full team sums to ~18). Even a fully type-advantaged
endgame team sits near a coin flip at the Champion. Audited numbers (2026-07-20,
6× power-3 team, base No = 1, only the round rising):

```
round  0: green=19 red= 1  yesShare=95.0%
round  4: green=19 red= 7  yesShare=73.1%
round  8: green=19 red=13  yesShare=59.4%
round 12: green=19 red=19  yesShare=50.0%   ← champion
```

The wheel is honest — this is a *balance* problem with **two independent roots**:

1. **No grows unbounded** with round while Yes has a hard ceiling. → **Lever A**
   lowers `ROUND_THREAT_MULT` so late battles stay hard but aren't coin-flips.
2. **The reward for good team-building is too small.** A power-3 Water vs Fire
   Pokémon contributes only `netScore(2) × ceil(3/4)=1 = +2` Yes tickets — barely
   more than a neutral pick. Progress outpaces *any* team the player can build,
   so scouting the opponent and countering their types is nearly pointless at the
   Champion. → **Lever B** doubles the per-Pokémon matchup unit so a
   thoughtfully-countered team is meaningfully favored, without touching the
   neutral case at all.

**Design intent (the reason both levers ship together): keep the core RNG intact
— you build your odds favorably, the wheel decides fate — but make *player
choices* matter more than raw progress.** Lever A is a small, flat relief for
everyone. Lever B is the agency lever: it only rewards players who build around
the opponent, leaving a neutral team untouched. The combination lifts a
well-built endgame team a lot and a random team only a little.

Neither is a bug fix; both are deliberate difficulty/agency tuning. This plan is
independent of `docs/plans/threat-single-draw-rework.md` (that concerns
*adventure* threat cards — a different "threat").

## The two levers

- **Lever A — `ROUND_THREAT_MULT`.** Exported constant in
  `src/app/services/battle-odds-service/battle-odds.service.ts:7` (the
  transparency plan already landed, so this is the single source of truth; the
  wheel and the win-% display both derive from it). Lower it.
- **Lever B — the per-Pokémon matchup unit `getMemberDelta`.**
  `src/app/services/type-matchup-service/type-matchup.service.ts:37`, currently
  `Math.ceil(member.power / 4)`. Change to `Math.ceil(member.power / 2)`.
  - **Why change `getMemberDelta` itself, not add an odds-only multiplier:** the
    same unit feeds both the wheel odds *and* the number the player sees in the
    battle-prep panel lead picker and the matchup strip. The
    battle-odds-transparency work deliberately kept the displayed delta and its
    ticket impact identical ("no drift"). A scaler applied only inside
    `computeOdds` would make the shown "+2" understate its real effect — breaking
    that invariant. Changing the unit at the source keeps display and odds
    consistent. The documented invariant "delta depends only on the Pokémon,
    never team composition" is **preserved** — it's still a pure function of the
    member.

## Decisions the owner locks before Phase 3 (recommendations baked in)

1. **Lever A value.** Candidate set: **1.5 (today) / 1.25 / 1.0**.
   **Recommendation: 1.25** — a conservative flat ease that lifts the neutral
   Champion off the coin flip (47.5% → 51.4%) without carrying well-built teams
   too far once Lever B is also in. 1.0 is the kinder-to-neutral-teams
   alternative (neutral Champion → 55.9%) but combined with Lever B pushes an
   advantaged Champion to ~74%, which may feel soft.
2. **Lever B symmetric vs advantage-only.** Doubling `getMemberDelta` doubles
   **both** the advantage bonus (more green for a good matchup) **and** the
   disadvantage penalty (more red for a bad one), because both sides multiply the
   same unit. **Recommendation: keep it symmetric** — it's the clean one-line
   change, it preserves the display/odds invariant above and the deliberate
   symmetric-scoring design (`docs/plans/done/type-matchup-symmetric-scoring.md`),
   and "bringing the wrong types is punished harder" is honest agency, not
   unfairness. Cost: a hard-countered team gets *worse* (Champion mismatch
   36.5% → 31.1%). A **neutral** team is unaffected either way. Advantage-only
   would require re-introducing display/odds drift and is not recommended.

Everything below is written for **Lever A = 1.25, Lever B = symmetric
`ceil(power/2)`**. If the owner picks different values, only the constants and
the "chosen" table rows change; the phase structure is identical.

## Projected odds (computed, reproducible)

All at the **Champion**: `baseNoCount 3`, `round 12`, 6× power-3 team. Neutral =
no type edge (yesTickets 19, unaffected by Lever B). Advantaged = Water vs Fire
(each member netScore 2). Elite Four uses `baseNoCount 2`, rounds 8–11.

**Decomposition — what each lever does at the Champion (single spin):**

| variant | roundThreat | neutral win | advantaged win |
|---|---|---|---|
| today (mult 1.5, unit /4) | 18 | 19/40 = **47.5%** | 31/52 = **59.6%** |
| Lever A only (1.25, /4) | 15 | 19/37 = **51.4%** | 31/49 = **63.3%** |
| Lever B only (1.5, /2) | 18 | 19/40 = **47.5%** | 43/64 = **67.2%** |
| **combined (1.25, /2)** | 15 | 19/37 = **51.4%** | 43/61 = **70.5%** |

Note the neutral column only moves with Lever A; Lever B is pure agency (advantaged
team: 59.6% → 67.2% with the multiplier untouched). Advantaged yesTickets rise
from 31 (unit /4: `18 + 6×2`) to 43 (unit /2: `18 + 6×4`).

**Whole endgame gauntlet — Elite Four (r8–r11) + Champion (r12), single-spin,
no retries (retries/potions lift the absolutes but the relative jump holds):**

| team | today (1.5, /4) | combined (1.25, /2) | relative |
|---|---|---|---|
| neutral | ~3.9% | ~5.5% | +40% |
| advantaged | ~10.9% | ~22.5% | +106% |

This is the headline: **each single late battle rises only a few points, but the
chance of clearing the whole endgame roughly doubles for a well-built team while a
random team barely moves** — exactly the agency-forward outcome. Per-round
combined-change win chances (single spin):

```
              neutral (yes 19)      advantaged (yes 43)
EF  r8  no=12   19/31 = 61.3%         43/55 = 78.2%
EF  r9  no=14   19/33 = 57.6%         43/57 = 75.4%
EF  r10 no=15   19/34 = 55.9%         43/58 = 74.1%
EF  r11 no=16   19/35 = 54.3%         43/59 = 72.9%
Champ r12 no=18 19/37 = 51.4%         43/61 = 70.5%
```

Early game barely moves: at gym round 2, `ceil(2 × 1.25) = 3` vs today's
`ceil(2 × 1.5) = 3` — identical; the change is almost entirely an endgame lift.

Phase 1 must regenerate the two headline tables from the real code (not by hand)
to confirm before anything ships.

## Current system (read before touching code)

- **Lever A** — `ROUND_THREAT_MULT` is exported from
  `src/app/services/battle-odds-service/battle-odds.service.ts:7`. Used once, in
  `computeOdds` (~line 83): `const roundThreat = Math.ceil(currentRound * ROUND_THREAT_MULT);`,
  folded into `rawNo`. `currentRound` is `leadersDefeatedAmount` (gyms 0–7, elite
  four 8–11, champion 12 in an 8-gym generation). Single definition — grep
  `ROUND_THREAT_MULT` to confirm before/after.
- **Lever B** — `getMemberDelta`
  (`src/app/services/type-matchup-service/type-matchup.service.ts:37`) returns the
  per-net-score-point ticket unit. It feeds:
  - `getMemberSignedDelta` → `calcTeamMatchupTotals` → battle odds (Yes advantage,
    No disadvantage) via `BattleOddsService.computeOdds`.
  - The battle-prep lead-picker delta badge:
    `battle-prep-panel.component.html:21-24` calls `getMemberDelta(pokemon)`
    directly to show `+N` / `-N` per candidate lead. **Verify this still reads
    sensibly after doubling** (numbers get bigger — that's intended, it makes the
    lead choice more legible).
  - The matchup strip advantage/disadvantage totals (`matchupAdvantageDelta` /
    `matchupDisadvantageDelta` in `base-battle-roulette.component.ts`).
- **Specs that hard-code the current numbers** (must be updated — see Phase 2/3;
  re-grep before editing, do not trust this list to be exhaustive):
  - Lever A: `grep -rn "1\.5\|threatMult\|round.*1\.5" src/app --include=*.spec.ts`
    — known: `base-battle-roulette.component.spec.ts` (~L98-103, expects
    `2 + ceil(3×1.5)`), `gym-battle-roulette.component.spec.ts` (~L111,
    `ceil(round(2)×1.5)+base(1)`), `elite-four-battle-roulette.component.spec.ts`
    (~L96, `ceil(round(1)×1.5)+base(2)`). Champion/rival specs may add cases.
  - Lever B: `grep -rn "getMemberDelta\|power / 4\|ceil(.*power\|unit ceil" src/app --include=*.spec.ts`
    — known: `type-matchup.service.spec.ts` (many assertions, ~L46-220 — the unit
    and every `netScore × unit` product), `battle-prep-panel.component.spec.ts`,
    `ability.service.spec.ts`, `gym-battle-roulette.component.spec.ts`. These
    specs write the arithmetic in their comments (e.g. `netScore 2 * unit ceil(5/4)=2`),
    so each failure is self-documenting — recompute with the new unit and update
    the comment.

**New unit reference — `getMemberDelta = ceil(power/2)`:**

```
power:  1  2  3  4  5  6  7  8
old /4: 1  1  1  1  2  2  2  2
new /2: 1  1  2  2  3  3  4  4     ← powers 1–2 unchanged; 3+ increases
```

So e.g. `type-matchup.service.spec.ts` L46-53 (`getMemberDelta` 1..8) becomes
`1,1,2,2,3,3,4,4`; a power-3 netScore-2 member's contribution becomes `2×2 = 4`
(was 2); a power-5 netScore-2 becomes `2×3 = 6` (was 4). Powers 1–2 are unchanged,
so any assertion using a power-1/2 member keeps its number.

## Phased steps

Checkpoint after each phase — do not run several in one stretch.

- [ ] **Phase 1 — Confirm the tables (no product change yet).** With a throwaway
  spec in `.../base-battle-roulette/` (reuse the `TestBattleRouletteComponent`
  pattern already in `base-battle-roulette.component.spec.ts`), drive
  `BattleOddsService.computeOdds` / `buildVictoryOdds` for the neutral and
  advantaged 6× power-3 teams across rounds 8–12 at each combination
  (`mult ∈ {1.5,1.25,1.0}` × `unit ∈ {/4,/2}`), logging `yesTickets/noTickets/winShare`
  and the gauntlet product. Reproduce the decomposition + gauntlet tables above.
  Post the numbers; **stop for the owner to lock Lever A value + symmetric choice.**
  Delete the throwaway spec.

- [ ] **Phase 2 — Lever A: lower `ROUND_THREAT_MULT`.** Set the constant in
  `battle-odds.service.ts:7` to the locked value (1.25 recommended). Update every
  Lever-A spec from the grep above to the new `ceil(round × mult)` expectations,
  keeping the explanatory comments accurate. `npm run test:local` — green.
  Checkpoint.

- [ ] **Phase 3 — Lever B: double the matchup unit.** Change `getMemberDelta`
  (`type-matchup.service.ts:37`) to `Math.ceil(member.power / 2)`; update the
  doc-comment (the "quarter of the Pokémon's own power" wording → "half"). Run
  `npm run test:local`; every failing type-matchup / prep-panel / ability / gym
  assertion is a hard-coded old-unit number — recompute it with the new unit
  (table above) and fix the inline comment. Manually sanity-check the battle-prep
  lead badge and matchup strip render sensible numbers. Green. Checkpoint.

- [ ] **Phase 4 — Docs, version, release notes.** Update `README.md`'s
  "Battle balancing" section to state the new multiplier **and** the new matchup
  unit + intent (endgame stays hard but not a coin flip; type-countering the
  opponent is now meaningfully rewarded). Bump `package.json` version (current
  `3.6.0` after transparency → `3.7.0`; confirm the current value first). Add a
  newest-first `RELEASE_NOTES` entry (`src/app/data/release-notes.ts`) with
  `whatsNew.v3_7_0.*` note keys (e.g. "Late-game battles are less punishing, and
  building a team that counters the opponent's types now pays off more") and add
  those keys + a `v3_7_0` version label to **all six** locale files
  (`src/assets/i18n/*.json`), `en` real, others English placeholder. When all
  phases are done, move this file to `docs/plans/done/`.

## Acceptance tests (input → expected, at locked values 1.25 + /2)

1. **Champion neutral.** 6× power-3, no type edge, `baseNoCount=3`, `round=12` →
   `yesTickets=19`, `noTickets = 3 + ceil(12×1.25) = 18`, winShare ≈ **51.4%**
   (was 47.5%). Confirms Lever A moved it and Lever B did not.
2. **Champion advantaged.** Same but Water vs Fire → `yesTickets = 18 + 6×(2×ceil(3/2)) = 43`,
   `noTickets = 18`, winShare ≈ **70.5%** (was 59.6%).
3. **Champion mismatched.** 6× power-3 Fire vs Water → `yesTickets=19`,
   `noTickets = 3 + 15 + 6×(2×ceil(3/2)) = 42`, winShare ≈ **31.1%** (was 36.5%) —
   confirms the symmetric penalty (owner accepted this in decision 2).
4. **Early game barely moves.** Gym round 2 → `roundThreat = ceil(2×1.25) = 3`,
   identical to today's `ceil(2×1.5)=3`.
5. **Powers 1–2 unchanged by Lever B.** `getMemberDelta(power 1)=1`, `(power 2)=1`
   before and after; any spec using such a member keeps its number.
6. **Floor intact.** A round-0 battle still yields `noTickets = baseNoCount` (the
   `Math.max(baseNoCount, …)` floor is unaffected by either lever).
7. **Full suite green** after all spec updates.

## Risks

- **Wide Lever-B spec blast radius.** Changing the matchup unit ripples through the
  whole `type-matchup.service.spec.ts` and several component specs, not just the
  round-threat ones. Run the two greps above before editing; lean on the
  self-documenting comment arithmetic; run the suite after Phase 3 and fix every
  failure mechanically. This is why Lever B is isolated in its own phase.
- **Display drift** if Lever B were done as an odds-only multiplier instead of at
  the source — don't; change `getMemberDelta` (see "Why" above).
- **Over-easing.** Combined at 1.0 + /2 pushes an advantaged Champion to ~74%,
  which may feel soft; 1.25 is the conservative recommendation. The Phase-1 table
  exists so this is decided on measured data.
- **Symmetric penalty makes bad matchups worse** (acceptance test 3). This is
  intended agency, but it is a player-facing difficulty change for mismatched
  teams — call it out in the release notes.
- Shipped difficulty changes → the README + release-notes work in Phase 4 is
  required, not optional.
