# Plan: Rebalance round-threat No scaling (lower the multiplier)

Status: **Not started.**
Owner: tormarod
Last updated: 2026-07-20

## Why

Battle No tickets grow with **progress**, not team strength. Each battle adds
`ceil(currentRound × ROUND_THREAT_MULT)` crimson slices, `ROUND_THREAT_MULT = 1.5`,
where `currentRound = leadersDefeatedAmount` climbs to ~12 by the Champion. Yes
tickets, by contrast, are capped by tiny power values (dex maxes at power 5; most
final evolutions are 3 — a full team sums to ~18). Audited numbers (2026-07-20):

```
same fixed 6× power-3 team, only the round rising (base No = 1):
round  0: green=19 red= 1  yesShare=95.0%
round  4: green=19 red= 7  yesShare=73.1%
round  8: green=19 red=13  yesShare=59.4%
round 12: green=19 red=19  yesShare=50.0%   ← champion
```

Even a fully type-advantaged endgame team (6× power-3 Water vs Fire → 31 green)
sits at **59.6%** at the Champion. The wheel is honest — this is a *balance* issue:
round-threat outpaces any team the player can realistically build. This plan lowers
`ROUND_THREAT_MULT` so late battles stay hard but not coin-flips.

Nothing here is a bug fix; it is a deliberate difficulty tuning. It is independent
of `docs/plans/threat-single-draw-rework.md` (that concerns *adventure* threat
cards — a different "threat"; the only link is that an adventure "bad omen" adds to
battle No via `battleDebuffService`, which this plan does not touch).

## Decision needed before Phase 2 (owner picks the value)

Phase 1 produces the before/after table below at candidate multipliers. The owner
then locks **one** `ROUND_THREAT_MULT` value. Candidate set: **1.5 (today) / 1.25 /
1.0 / 0.75**. Recommendation: **1.0** — it lifts the advantaged-endgame Champion
from 60% to ~67% and the neutral case from ~48% to ~56%, without trivializing
(still clearly below the ~85% of a mid-game favored wheel). This plan is written to
land whichever value is chosen; only the constant and the table's "chosen row"
differ.

## Projected odds by multiplier (computed, reproducible)

Champion = `baseNoCount 3`, `round 12`, 6-member team. Yes tickets fixed by the
team; only `roundThreat = ceil(12 × mult)` changes, so `noTickets = 3 + roundThreat`.

**Advantaged team (6× power-3 Water vs Fire → yesTickets = 31):**

| mult | roundThreat | noTickets | winChance |
|------|-------------|-----------|-----------|
| 1.5  | 18 | 21 | 31/52 = **59.6%** |
| 1.25 | 15 | 18 | 31/49 = **63.3%** |
| 1.0  | 12 | 15 | 31/46 = **67.4%** |
| 0.75 | 9  | 12 | 31/43 = **72.1%** |

**Neutral team (6× power-3, no type edge → yesTickets = 19):**

| mult | noTickets | winChance |
|------|-----------|-----------|
| 1.5  | 21 | 19/40 = **47.5%** |
| 1.25 | 18 | 19/37 = **51.4%** |
| 1.0  | 15 | 19/34 = **55.9%** |
| 0.75 | 12 | 19/31 = **61.3%** |

Early game is barely affected (at round 2, `ceil(2×mult)` is 3/3/2/2 — a 0–1 slice
difference). The change is almost entirely an endgame lift, which is the goal.

Phase 1 must regenerate these with the real code (not by hand) to confirm.

## Current system (read before touching code)

- `BaseBattleRouletteComponent`
  (`src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.ts`):
  - `private static readonly ROUND_THREAT_MULT = 1.5;` (**line 38** — the single
    knob).
  - `const roundThreat = Math.ceil(currentRound * BaseBattleRouletteComponent.ROUND_THREAT_MULT);`
    (**line ~179**), folded into `rawNoCount`.
  - `currentRound` is bound from `roulette-container`'s `leadersDefeatedAmount`
    (gyms 0–7, elite four 8–11, champion 12 in an 8-gym generation).
- **If `docs/plans/battle-odds-transparency.md` has already landed**, the constant
  lives in `src/app/services/battle-odds-service/battle-odds.service.ts` as the
  exported `ROUND_THREAT_MULT`. Change it there instead; everything downstream
  (wheel + the new win-% display) updates from the one source automatically — a nice
  reason to land that plan first, though not required.
- **Specs that hard-code the current formula** (must be updated to the chosen mult):
  - `base-battle-roulette.component.spec.ts:98-103` — "produces 1 yes and
    baseNoCount+round*threatMult no slices": expects `noCount === 7` (`2 + ceil(3×1.5)`).
  - `gym-battle-roulette.component.spec.ts:~111` — comment + expectation `ceil(round(2)×1.5)+base(1)=4`.
  - `elite-four-battle-roulette.component.spec.ts:~96` — `ceil(round(1)×1.5)+base(2)=4`.
  - Re-grep before editing: `grep -rn "1.5\|threatMult\|round.*1.5" src/app --include=*.spec.ts`
    (champion/rival specs may add cases; fix any that encode the old number).

## Phased steps

Checkpoint after each phase.

- [ ] **Phase 1 — Confirm the table (no product change yet).** Reproduce the two
  tables above from the real code at all four candidate mults, so the owner picks
  from measured numbers, not estimates. Do this with a throwaway spec (delete after)
  in `.../base-battle-roulette/` that drives `buildVictoryOdds` (reuse the
  `TestBattleRouletteComponent` pattern already in
  `base-battle-roulette.component.spec.ts`), looping `ROUND_THREAT_MULT`-equivalent
  rounds and logging `green/red/winShare` for the advantaged and neutral 6× power-3
  teams at the Champion. Post the numbers; **stop for the owner to choose the value.**

- [ ] **Phase 2 — Apply the chosen multiplier.** Set `ROUND_THREAT_MULT` to the
  locked value (in `base-battle-roulette.component.ts` line 38, or
  `battle-odds.service.ts` if transparency landed first). Update every spec listed
  above to the new expected `ceil(round × mult)` values, keeping the explanatory
  comments accurate. Run `npm run test:local` — green.

- [ ] **Phase 3 — Docs, version, release notes.** Update `README.md`'s battle-
  balancing section (the round-threat / "Battle balancing" math explanation) to state
  the new multiplier and the intent (endgame stays hard, not a coin flip). Bump
  `package.json` version (`3.5.0` → next; if transparency already bumped to `3.6.0`,
  use `3.7.0`, else `3.6.0`). Add a newest-first `RELEASE_NOTES` entry
  (`src/app/data/release-notes.ts`) with a `whatsNew.v<x>_<y>_<z>.0` note key (e.g.
  "Rebalanced late-game battles — Elite Four and Champion odds are less punishing")
  and add that key + version label to **all six** locale files
  (`src/assets/i18n/*.json`), `en` real, others English placeholder. When all phases
  are done, move this file to `docs/plans/done/`.

## Acceptance tests (input → expected)

Using the value **the owner locks** in Phase 2 (example rows assume `1.0`):

1. **Champion neutral.** 6× power-3, no type edge, `baseNoCount=3`, `round=12` →
   `noTickets = 3 + ceil(12 × mult)`; at mult 1.0, `noTickets = 15`, `yesTickets = 19`,
   winShare ≈ 55.9%.
2. **Champion advantaged.** Same but Water vs Fire (`yesTickets = 31`) → at mult 1.0
   winShare ≈ 67.4%.
3. **Early game barely moves.** Gym round 2, empty-ish team: `roundThreat = ceil(2 × mult)`
   differs from today by ≤ 1 slice.
4. **Floor intact.** A round-0 battle still yields `noTickets = baseNoCount` (the
   `Math.max(baseNoCount, …)` floor is unaffected by the multiplier).
5. **Full suite green** after spec updates; the unrelated matchup/lead/ability specs
   are untouched.

## Risks

- **Missed hard-coded spec** — one un-updated `ceil(round×1.5)` expectation will fail
  the suite; the Phase-1 grep enumerates them, re-run it before Phase 2.
- **Two sources of the constant** if transparency landed first — change it in
  `battle-odds.service.ts` only; the component re-exports/imports it. Confirm there is
  a single definition (grep `ROUND_THREAT_MULT`) after editing.
- **Over-easing** — 0.75 pushes the neutral Champion above 60% and the advantaged
  case above 72%, which may feel too soft; the recommendation (1.0) is deliberately
  conservative. The Phase-1 table exists so this is decided on data.
- This changes shipped difficulty; it is a player-facing balance change, hence the
  release-notes + README requirement (do not skip Phase 3).
```
