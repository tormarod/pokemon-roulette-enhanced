# Plan: Type Advantage/Disadvantage Rework

Status: **Phases 1-4 implemented, tested, and committed (Phase 4 revised — see
below); Phase 5 (docs) pending; Phase 6 (dual-type depth) approved, not started**
Owner: tormarod
Last updated: 2026-07-16

> Handoff note for the execution session: everything you need is in this file.
> You should not need to re-research the battle system from scratch — the
> "Current system" section is the ground truth as of this date. Verify the
> specific line references still hold, then implement phase by phase, pausing
> for review after each phase (see CLAUDE.md workflow notes).

---

## 1. Goal

Make type matchup **feel meaningful and impactful** without letting edge cases
get out of hand. Specifically:

- A good/bad matchup should visibly change the odds and reward players who
  understand type strengths.
- Edge cases must stay bounded — e.g. a lone starter with a bad matchup at the
  first gym should not be a near-unwinnable wall.
- Frustrating moments are acceptable, but must be the exception, not the norm.
- Decide whether/how to model **double-typing**, and whether it helps the player
  or merely adds uncontrollable variance.

## 2. Current system (ground truth)

Files:
- `src/app/services/type-matchup-service/type-matchup.service.ts` — the model.
- `src/app/services/type-matchup-service/type-matchups-data.ts` — per-type
  `strongAgainst` / `weakAgainst` lists (offense-oriented).
- `src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.ts`
  — `buildVictoryOdds()` turns the totals into wheel tickets.
- Per-battle base "No" counts: gym `1`, rival `1`, elite-four `2`, champion `3`
  (each battle component's `calcVictoryOdds()`), all plus `currentRound`.

How odds are built today:
- `Yes tickets = round(yesPower + xAttackMods) + 1`
  where `yesPower = Σ member.power + Σ advantageDelta`.
- `No tickets = baseNo + currentRound + Σ disadvantageDelta`.
- `Win% = Yes / (Yes + No)`.

Type effect is **boolean per team member**:
- `isStrong` = any of the member's types is super-effective (SE) against any
  opponent type → adds `advantageDelta = ceil(power/2)` to **Yes**.
- `isWeak` = any opponent type is SE against any of the member's types → adds
  `disadvantageDelta = ceil(power/2)` to **No**.
- A member that is both strong and weak contributes neither (cancels).
- `power` is an integer `1..8`.

Key limitations:
1. **Offense only.** Only super-effective relationships exist in the data.
   Resistances (0.5×), immunities (0×), and 4×/0.25× stacking are not modeled,
   so a defensively excellent matchup feels identical to a neutral one.
2. **No gradient.** Barely-1×-SE coverage and a clean 4× answer give the same
   `ceil(power/2)` bonus.
3. **Double-typing is nearly invisible** — it only shows up as the strong+weak
   cancel, which reads as arbitrary to players.

### Worked examples of the current curve (for calibration)

Single starter, power 2, first gym (`baseNo=1`, `round=0`):
- Neutral: Yes 3 / No 1 → **75%**
- Advantage: Yes 4 / No 1 → **80%**
- Disadvantage: Yes 3 / No 2 → **60%**

Full team late gym (6 mons avg power 5 → yesPower 30, `round=7`, `baseNo=1`):
- Neutral: Yes 31 / No 8 → **~80%**
- Two strong-only members (+3 each): Yes 37 / No 8 → **~82%**
- Two weak-only members: Yes 31 / No 14 → **~69%**

Takeaway: the full-team curve is already fairly well-behaved; the swings are
modest. The shallow *feel* (offense-only, no gradient, invisible double-type)
and the **early-game single-Pokémon swinginess** are the real problems, not
runaway blowouts in the mid/late game.

## 3. Design analysis

### 3.1 Where does player agency live?

The wheel itself is luck. The player's real levers are **team composition** (via
catching), **items**, and item timing. Therefore the type system should reward
things the player *controls* — chiefly building a team with a typed answer to
each opponent — and avoid adding per-spin variance the player cannot steer.

This is the lens for every option below: **does it reward a decision the player
made, or does it just add noise?**

### 3.2 Should we model double-typing? (the explicit question)

Recommendation: **Yes, but model it as coverage, not as raw multiplicative
swings.**

- A faithful 4×/2×/1×/0.5×/0.25×/0× per-member multiplier is the most
  "accurate," but in a low-agency wheel game it mostly amplifies variance the
  player can't influence, and a 4× weakness on your only early mon is exactly
  the "unwinnable first gym" failure we want to avoid. **Not recommended as-is.**
- Instead, let double-typing matter through **defensive resistance/immunity**
  (currently ignored) and through **magnitude caps** at the team level, so that
  a well-built, type-diverse team is rewarded for *having a clean answer*, while
  a single unlucky double-weak mon is softened by a floor rather than punished
  4×.

Net: double-typing becomes a reason to build coverage (good, rewards knowledge)
rather than a coin-flip multiplier (bad, adds randomness).

### 3.3 Guardrails against edge cases

- **Per-member delta cap** so no single mon can swing the wheel wildly (already
  partly true; make it explicit and tune).
- **Early-game floor**: when the team is small (1–2 members), compress the
  disadvantage contribution so a bad starter matchup lands around a coin flip,
  not a wall. Tie the floor to team size or total team power, not to the round.
- **Symmetry review**: today advantage grows Yes while disadvantage grows No.
  Confirm this asymmetry is intended; consider making magnitude symmetric so the
  displayed advantage/disadvantage numbers are comparable.

## 4. Proposed model

Introduce a **graded, capped, team-level matchup score** that extends (not
replaces) the current ticket model.

1. **Add defensive data.** The `weakAgainst` lists already exist in
   `type-matchups-data.ts` but are unused by the service — wire them in, and add
   `resists` (0.5×) / `immuneTo` (0×) so defense finally counts.
2. **Per-member effectiveness tier** from combining its 1–2 types against the
   opponent's types, bucketed (not raw-multiplied):
   - `strong` (net offensive SE and/or resists incoming) → positive delta
   - `neutral` → 0
   - `weak` (net incoming SE, no resistance) → negative delta
   - `hard-countered` (double-weak / 4×) → larger negative delta, **but capped**
3. **Delta magnitude** stays proportional to `power` (keep `ceil(power/2)` as the
   base unit) with an explicit per-member cap, e.g. `min(ceil(power/2)+tier, CAP)`.
4. **Team-level floor** when `team.length <= 2`: scale total disadvantage by a
   factor (e.g. 0.5) so early bad matchups are softened.
5. **Keep the existing UI contract**: `advantageDelta` / `disadvantageDelta` /
   `advantageTypes` / `disadvantageTypes` must still be returned so the matchup
   strip and tooltip keep working (the tooltip multi-type fix from the prior
   session must not regress).

Exact tier→delta numbers are a **tuning exercise** (Phase 4) — the plan fixes the
shape, not the final constants.

## 5. Implementation phases (checkpoint after each)

**Phase 1 — Data layer. ✅ DONE.** Extended `type-matchups-data.ts` with
`resists` and `immuneTo` per type (canonical Gen 6+ chart), added the two
fields to `TypeMatchupEntry` in `interfaces/type-matchup.ts`. Added
`type-matchups-data.spec.ts` asserting shape and spot-checking known
resistances/immunities against the real chart. No behavior change.

**Phase 2 — Scoring core. ✅ DONE.** Added `resists()` / `isImmuneTo()`
lookups, `getDefenseTier()` (immune / doubleWeak / weak / safe, folding in
resist-cancellation across a member's two types), `getMemberTier()`
(strong / neutral / weak / hard-countered, combining offense with the graded
defense read — immune → strong per the immunity decision below, offense+weak
still cancels to neutral as before), and `getTierDeltaMagnitude()` (base
`ceil(power/2)`, +1 for hard-countered, capped at `MAX_MEMBER_DELTA = 5`) to
`TypeMatchupService`. Covered by unit tests in `type-matchup.service.spec.ts`
(single-type, double-type-stacked, immunity, immunity-overrides-other-weakness,
resist-cancellation, empty-opponent-types).

**Phase 3 — Wire into odds. ✅ DONE.** `calcTeamMatchupTotals` now buckets
each member via `getMemberTier` and sizes the delta via
`getTierDeltaMagnitude`, replacing the old boolean isStrong/isWeak check. The
return shape (`yesPower` / `noBonus` / `advantageDelta` / `disadvantageDelta`)
is unchanged, so `base-battle-roulette` and the matchup-strip UI needed no
changes. Full suite (394 tests) passes; `getMemberMatchup` (superseded) was
removed as dead code.

**Phase 4 — Tuning & guardrails. ✅ DONE — committed (revised 2026-07-16 after review).**
No early-game floor (decision: leave swingy). Disadvantage stays on the **No**
side (green = full power always, so a member's bulk always shows; the penalty
is extra red, never lost green):

- **weak** → `ceil(power/2)` red No tickets (the base unit).
- **hard-countered** → **double** that, `2 * ceil(power/2)`, **uncapped**.

Rationale for the revision (superseding the original `+1` bonus / `MAX_MEMBER_DELTA = 5`
cap): the `+1` bonus plus the cap made weak and hard-countered converge at high
power (both landed at ~5), so a hard counter "felt the same" as a plain
weakness. Doubling the unit keeps hard-countered strictly harsher than weak at
**every** power — including power 1 (weak 1 red vs hard 2) — and at every team
size (same green, more red ⇒ strictly lower win%). The value is already bounded
by the 1..8 power range (max 8 red), so the flat cap was removed as both
redundant and harmful (it flattened exactly the high-power hard counters we
want to bite). Lone-starter landings: power-2 weak 60% / hard 50%; power-8 weak
64% / hard 50%.

Accepted tradeoff (confirmed with the user): because disadvantage adds No
tickets, a hard-countered member can, in an already-winning position, lower the
team's odds vs. not fielding it — i.e. occasionally "5 is better than 6." This
was explicitly accepted as fine for a small luck-based roulette game, in
exchange for the red-slice visual, retained bulk, and the guaranteed
weak-vs-hard ordering. (An alternative Yes-subtraction model that preserves
strict "6 always ≥ 5" monotonicity was considered and rejected: it cannot show
red slices and collapsed high-power hard counters toward a single Yes ticket.)

**Phase 5 — Dual-type depth: reward resistance, dedupe opponent types, sync the
display.** *Not yet started — approved 2026-07-16.* Motivated by a review of the
canonical dual-type defensive chart (https://pokemondb.net/type/dual). Key
finding: that chart is nothing we need to hardcode — every cell is the *product*
of the single-type relationships we already store (`strongAgainst` / `resists` /
`immuneTo`), and `getDefenseTier` already computes it in log₂ (exponent) space
(`exponent = #memberTypesWeak − #memberTypesResist`, immunity short-circuits to
0). We already do the dual-type math; we just quantize it. So this phase is
*small* — no new data, no 171-row table, no floating-point ticket math. Three
changes, all integer/tier-based:

1. **Reward the resist end (the real missing half).** Today only the `2×`/`4×`
   (weak/doubleWeak) and `0×` (immune) ends drive deltas; a member that *net
   resists* the opponent (`0.5×`/`0.25×`) but isn't offensively super-effective
   reads as `neutral` and contributes nothing — a defensively excellent matchup
   feels identical to a blank one (the §2 limitation #1 we never closed).
   - Extend `getDefenseTier` to also surface `resist` (one opponent type netting
     `exponent ≤ −1` and no weakness) and `doubleResist` (`exponent ≤ −2`, or
     resists ≥ 2 distinct opponent types, still no weakness).
   - Add a `resistant` tier to `getMemberTier` that feeds `advantageDelta` with a
     **smaller** magnitude than an offensive/immune `strong` (suggest ~half a
     strong bonus, e.g. `ceil(power/4)` with a sensible floor — **tunable**,
     shape not final numbers, per the Phase-4 precedent). Precedence stays:
     immunity > offense/weakness > resist (a member weak to any opponent type is
     still `weak`/`hard-countered`, never rescued to `resistant`).
   - Keep raw multipliers *out* of the ticket math — this stays bucketed, per
     decision §7.1. We're adding the missing buckets, not switching to `4×/0.25×`
     scaling.

2. **Fix the duplicate-opponent-type bug.** `getDefenseTier` counts
   `weakOpponentTypeCount` per *array entry*, not per *distinct type*, so a
   trainer whose `types` list repeats a type — Lance is `['dragon','dragon']` —
   makes a dragon-weak member read as weak to "two opponent types" ⇒ falsely
   `doubleWeak` ⇒ now *doubled* penalty. Dedupe `opponentTypes` before the
   count-based logic (robust against any future dup), and clean the obviously
   accidental data entries (`['dragon','dragon']`, `['normal','normal']` — the
   latter is harmless since Normal is SE against nothing, but still wrong). Add a
   regression test asserting a dragon-typed member vs `['dragon','dragon']`
   classifies as `weak`, not `hard-countered`.
   > Reminder on the data's meaning: an opponent `types` list is a *trainer's
   > team theme* (2–3 types, sometimes dup'd), **not** one dual-type Pokémon. So
   > we never multiply the opponent's own types together (a 3-type leader isn't a
   > `4×`-anything). The dual-type product only ever applies to *our* member's
   > two types taking a hit from *each* opponent type — exactly `getDefenseTier`'s
   > existing domain.

3. **Sync the matchup-strip display with the graded model.** The advantage/
   disadvantage *delta numbers* are already correct (they come from the graded
   `calcTeamMatchupTotals`), but the type-**icon** rows come from
   `getMatchupTypes`, which still uses raw boolean per-type super-effectiveness
   and ignores resist/immunity folding. Consequences to fix:
   - A dual-type member whose weakness is *covered* (Dragon/Water vs Ice → net
     neutral) still shows a red disadvantage icon with a `0` effect.
   - An immune wall (Flying vs Ground) contributes a positive advantage delta but
     shows **no** advantage icon; likewise the new `resistant` members should
     surface as an advantage.
   - Rework `getMatchupTypes` so the icon rows reflect the member-level tier, not
     raw per-type SE. Known subtlety: the icon rows are per-*type* while a tier is
     per-*member* (a member's two types can disagree) — decide during
     implementation whether to surface the member's decisive type or drop to a
     per-member representation; document whichever.
   - **Opponent-type row:** confirmed already correct — all four battle strips
     (gym/rival/elite-four/champion) and the pre-battle opponent preview already
     `@for` over the full `.types` list (the preview even shows a "one of" note
     for multi-type trainers). The user's "might only show one type" concern
     appears already resolved; this phase just adds a test confirming the full
     list renders, and closes it out.

**Phase 6 — Docs.** Update `README.md` balancing section to describe the new
approach; note the change in the fork changelog. Update this plan's status.
*Not yet started — pausing for review before touching README.*

Checkpoint after each of the three, per CLAUDE.md. Suggested order: (2) dedupe
bugfix first (smallest, pure correctness, independent), then (1) resist tier,
then (3) display sync (depends on 1's new tiers).

## 6. Testing / validation

- Unit tests per phase (data, scoring, odds) — the repo runs Karma/Jasmine via
  `npm test` (see CLAUDE.md).
- A scenario table asserting win% for: lone starter (adv/neutral/disadv/4×),
  mid-game team, full late team, immunity case, double-resist case.
- Manual play-test of the first gym with a deliberately bad starter to confirm
  it lands near a coin flip, not a wall.
- **Phase 6:** regression test for the duplicate-opponent-type case (dragon vs
  `['dragon','dragon']` ⇒ `weak`, not `hard-countered`); `resist`/`doubleResist`
  tier classification tests (incl. a resist that is *not* rescued when the member
  is also weak to another opponent type); `getMatchupTypes` display tests showing
  covered weaknesses drop out and immune/resistant members surface as advantages;
  a test confirming the opponent-type icon row renders every entry in `.types`.

## 7. Open decisions — RESOLVED 2026-07-16

1. **Double-type stance** — **coverage-based tiers**, per §3.2 recommendation.
   No raw multipliers. **Extended in Phase 6 (2026-07-16):** after reviewing the
   canonical dual-type chart we confirmed the stance holds — the chart is
   derivable from data we already store and we already compute it in exponent
   space, so "implementing dual types" means *adding the missing resist buckets*,
   not switching to `4×/0.25×` scaling. Still no raw multipliers in the ticket
   math.
2. **Early-game floor** — **no floor**. Leave early game swingy on purpose;
   teams of ≤2 are not softened.
3. **Advantage/disadvantage symmetry** — **keep today's asymmetry**
   (advantage→Yes, disadvantage→No). Only the magnitude computation changes
   (tiered instead of boolean), not which bucket it lands in. **Reaffirmed after
   review (2026-07-16):** disadvantage stays on No specifically so a bad matchup
   shows as red slices and every member keeps its full power in green. The known
   consequence — a hard counter can make fielding a member net-negative when
   already winning ("5 better than 6") — was explicitly accepted rather than
   traded away for strict monotonicity. See Phase 4 for the weak-vs-hard
   magnitude split that came out of the same review.
4. **Immunities** — a 0× (immune) member counts as a **hard advantage**
   (treated like a strong defensive tier, contributes to `advantageDelta`).

Status: **decisions locked — proceeding to Phase 1.**
