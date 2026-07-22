# Plan: Trim duplicate/irrelevant specs

Status: **Approved — ready to execute.**
Owner: tormarod
Last updated: 2026-07-22

## Why

The suite has grown to 97 spec files / ~12,300 lines and the user asked for an
audit: not "do we have too many tests" (more coverage is fine) but "do we have
*duplicate or irrelevant* ones." Six parallel research passes covered every
spec file in the repo. Four came back clean — the size of files like
`run-persistence.service.spec.ts` (914 lines) and `stats.service.spec.ts`
(679 lines) is legitimate one-test-per-field/behavior regression coverage,
not duplication, and should **not** be touched by this plan.

Two areas had real, verifiable duplication:

1. **Battle roulette specs** — leftover from before commit `2ed8e27`
   ("Deduplicate the four battle roulette components onto a shared base").
   `gym`/`elite-four`/`champion`/`rival`-battle-roulette now all extend
   `base-battle-roulette.component.ts`, but several of their specs still
   carry pre-dedup copies of tests that now exercise only inherited,
   already-tested base behavior.
2. **`roulette-container.component.spec.ts`** — several `describe` blocks for
   individual adventure threats split "the effect happens" and "the state
   resolves (doNothing was called)" into two separate `it()`s with identical
   (or near-identical) setup, when one test could assert both.

All line numbers below were verified against the current working tree on
2026-07-21 (not stale from the original audit — two extra duplicate pairs in
`roulette-container.component.spec.ts`, for `scoutingReport` and `pcLockout`,
were found on re-verification because that file grew between the audit and
this plan being written). **Re-run each `grep -n "it('"` shown per step before
editing** in case the file has moved on again since — anchor on test titles,
not line numbers, if they've drifted.

**Re-verified 2026-07-22 against `origin/main` (commit `3c79f3a`) — no drift.**
Every referenced test in all three phases still sits at the exact title *and*
line number stated below; nothing needs renumbering. Since this plan was
committed the only spec change was the Running Shoes→Bicycle rename
(`fa68cb2`, net-zero lines in a `describe('bicycle bonus step')` block that is
not one of Phase 2's seven threats), so it does not affect any step here. The
"anchor on titles, re-grep before editing" rule above still stands as
cheap insurance, but as of this date the numbers are current.

## Ground rules for every step

- Delete only the identified redundant `it()` block(s); do not touch the test
  that stays, its `describe`/`beforeEach` scaffolding, or any other test.
- After each file's edits, run that file's spec alone
  (`ng test --watch=false --include=<path>`) before moving to the next file.
- Run the full suite (`npm run test:local`) once at the end of each phase.
- If any listed test's current content doesn't match what's described below
  (i.e. it's drifted since 2026-07-21), stop and re-confirm with the user
  before deleting it — don't guess.

## Phase 1 — Battle roulette specs

### 1a. `base-battle-roulette.component.spec.ts` vs `battle-odds.service.spec.ts`

`buildVictoryOdds()` (`base-battle-roulette.component.ts`) is a thin wrapper
around `battleOddsService.computeOdds()`. The following 7 tests in
`src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.spec.ts`
duplicate math already asserted in
`src/app/services/battle-odds-service/battle-odds.service.spec.ts`:

| Delete from `base-battle-roulette.component.spec.ts` | Already covered by `battle-odds.service.spec.ts` |
|---|---|
| line 116 `'produces 1 yes and baseNoCount+round*threatMult no slices for an empty, untyped team'` | line 24 `'produces 1 yes and baseNoCount+round*threatMult no tickets for an empty, untyped team'` |
| line 133 `'boosts yes by the net-score-scaled unit for a mutual-advantage matchup'` | line 32 (identical title) |
| line 144 `'adds extra No tickets (not fewer Yes) for a mutual-disadvantage matchup'` | line 43 (identical title) |
| line 214 `'applies the x-attack power bonus on top of the type-adjusted yes power'` | line 82 (identical title) |
| line 254 `'doubles the advantage for a lead with a favorable matchup'` | line 53 (identical title) |
| line 267 `'doubles the disadvantage (extra No tickets) for a lead with an unfavorable matchup'` | line 63 (identical title) |
| line 311 `'adds the pending battle debuff to the No tickets'` | line 74 `'adds the pending battle debuff (badOmen) to the No tickets'` |

**Action:** delete these 7 `it()` blocks from `base-battle-roulette.component.spec.ts`.
Add one replacement smoke test in their place (near where line 116 was) that
just confirms delegation, e.g.:

```ts
it('delegates odds math to BattleOddsService and maps tickets into wheel items', () => {
  const spy = spyOn(battleOddsService, 'computeOdds').and.callThrough();
  // build with any team/opponent already used elsewhere in this file
  component.buildVictoryOdds();
  expect(spy).toHaveBeenCalled();
  // assert the returned wheel items' count/labels reflect computeOdds()'s yesTickets/noTickets,
  // using the textPrefix passed in — this is the part base.ts adds on top of the service call
});
```

(Exact assertions depend on `buildVictoryOdds()`'s actual return shape —
read the current method body first; the point is to cover "delegates
correctly + maps into WheelItems with the right prefix," not to re-derive
odds numbers.)

**Keep, do not touch:** every other test in this file — untyped-opponent
handling (124), power scaling/plateau (154, 161), neutral cancellation (168),
per-member independence (178), multi-type aggregation (200), potion-tier
fallback (225, 234, 247), neutral-lead/no-op cases (280, 291, 300), no-debuff
case (321), scouting-type block (333-373), and the shared
win/loss/cleanup block (376-433) — none of these are covered by
`battle-odds.service.spec.ts`.

### 1b. `gym-battle-roulette.component.spec.ts` — shared `onItemSelected` re-tested

Neither `gym` nor `elite-four` battle roulette overrides `onItemSelected`
anymore (it lives only in `base-battle-roulette.component.ts`, already
covered by that file's lines 376-433). Delete these from
`src/app/main-game/roulette-container/roulettes/gym-battle-roulette/gym-battle-roulette.component.spec.ts`:

- line 205 `'should emit true on winning spin regardless of retries'`
- line 217 `'should reset retries to 1 and consume potion on failed spin when potion is available'`
- line 235 `'should emit false on failed spin when retries exhausted and no potion available'`
- line 248 `'should clear any pending Forced Retreat lock on a winning spin'`
- line 260 `'should clear any pending Forced Retreat lock on a losing spin with retries exhausted'`
- line 273 `'should clear any pending Marked Target mark on a winning spin'`
- line 285 `'should clear any pending Marked Target mark on a losing spin with retries exhausted'`

**Keep:** everything else in this file, including `'should create'` (77),
the gym-specific odds-wiring tests (83-190, these are gym's own
`buildVictoryOdds()` override/config, not shared base logic — verify this
before deleting anything in this range, don't assume), `fromLeaderChange`
(300), the prep-panel block (326-364), and Serene Grace (400).

From `src/app/main-game/roulette-container/roulettes/elite-four-battle-roulette/elite-four-battle-roulette.component.spec.ts`,
delete:
- line 135 `'should reset retries to 3 and consume hyper-potion on exhausted spin'`

(This is elite-four's variant of the same already-covered
`onItemSelected` potion-consumption path — the retry-count/potion-tier
specifics for elite-four are config, but the *mechanism* being exercised is
identical to gym's version, which itself duplicates the base spec per 1a/1b.
If gym's copy is deleted per above, there's no other spec left asserting
"hyper-potion for a 3-retry battle type" — before deleting this one, confirm
`base-battle-roulette.component.spec.ts`'s cleanup block (376-433) uses a
battle type/retry count that already exercises multi-retry potion
consumption; if it only tests a 1-retry case, keep this elite-four test
instead of deleting it, since it'd be the last remaining coverage of
multi-retry potion cycling.)

### 1c. "clears the prep once battle resolves" duplicated 4x verbatim

Same test, same assertions, only `battleKey`/text prefix differs. Keep one
copy (gym's, since it's the one with both win and loss variants) and delete
the other three:

- **Keep:** `gym-battle-roulette.component.spec.ts:374` (win) and `:386` (loss)
- **Delete:** `elite-four-battle-roulette.component.spec.ts:224` (win) and `:236` (loss)
- **Delete:** `champion-battle-roulette.component.spec.ts:143` (win) and `:155` (loss)
- **Delete:** `rival-battle-roulette.component.spec.ts:198` (win only — rival has
  no equivalent loss-clears-prep test at this location; leave rival's other
  tests alone)

### 1d. "doubles lead's delta" / "consumes x-attack" duplicated 4x verbatim

Same math, same assertions, only `battleKey`/text prefix differs. Keep gym's
copy, delete the other three:

- **Keep:** `gym-battle-roulette.component.spec.ts:336` (lead delta) and `:348` (x-attack)
- **Delete:** `elite-four-battle-roulette.component.spec.ts:187` and `:198`
- **Delete:** `champion-battle-roulette.component.spec.ts:106` and `:117`
- **Delete:** `rival-battle-roulette.component.spec.ts:147` and `:158`

### Phase 1 acceptance

- `npm run test:local` passes, full suite.
- Total spec line count for the battle-roulette family (base + gym + rival +
  elite-four + champion + battle-odds.service) drops by roughly 250-300
  lines with zero coverage loss (confirm by re-reading each file's remaining
  tests against `base-battle-roulette.component.ts`'s actual public surface
  before considering this phase done).

## Phase 2 — `roulette-container.component.spec.ts`

Each pair below has the *first* test asserting the threat's actual effect,
and a *second* test ("resolves the state" / "resolves the state either way")
that only re-runs the same (or near-identical) setup to check
`component.doNothing` fired. Merge each pair into the first test by adding a
`spyOn(component, 'doNothing').and.callThrough()` and a final
`expect(component.doNothing).toHaveBeenCalled();` to it, then delete the
second test.

All in `src/app/main-game/roulette-container/roulette-container.component.spec.ts`:

1. **`itemTheft`** (describe starts ~line 993): merge line 1011
   (`'shows a "nothing found" modal without throwing when the inventory is
   empty'`) with line 1016 (`'resolves the state (does not get stuck) either
   way'`) — both run with an empty inventory, no setup difference. Delete 1016.
2. **`markedTarget`** (describe ~1025): merge line 1038 (`'with team >= 2 →
   marks one team index and shows a modal'`) with line 1059 (`'resolves the
   state (does not get stuck) either way'`) — both add the same two team
   members. Delete 1059.
3. **`badOmen`** (describe ~1122): merge line 1130 (`'sets a pending battle
   debuff and shows a modal'`) with line 1137 (`'resolves the state'`) — no
   setup at all in either. Delete 1137.
4. **`pokeballMalfunction`** (describe ~1181): merge line 1189 (`'sets a
   pending catch escape chance and shows a modal'`) with line 1196
   (`'resolves the state'`) — no setup in either. Delete 1196.
5. **`tollBooth`** (describe ~1239): merge line 1259 (`'balance 0: pays
   nothing, applies the max spike tier (fully unpaid)'`) with line 1278
   (`'resolves the state either way'`) — both rely on the default 0 balance,
   no setup difference. Delete 1278.
6. **`scoutingReport`** (describe ~1287): line 1309 (`'sets a type
   super-effective against the highest-power member (team + PC combined)'`)
   adds a team member *and* a PC member; line 1321 (`'resolves the state
   either way'`) adds only a team member. **Setup is not identical** — before
   merging, confirm adding the doNothing spy/assertion to 1309's existing
   setup still exercises a non-empty roster (it does — 1309 already adds
   `makePokemon(1, 1, 'water')` to the team). Add the doNothing spy/assertion
   to 1309, delete 1321. (Line 1300's empty-roster case is untouched — it's
   the only test of that branch and isn't part of this duplication.)
7. **`pcLockout`** (describe ~1331): merge line 1344 (`'with total >= 2 →
   locks the PC and shows a modal'`) with line 1364 (`'resolves the state
   either way'`) — both add the same two team members. Delete 1364.

### Phase 2 acceptance

- `npm run test:local` passes, full suite.
- `roulette-container.component.spec.ts` shrinks by 7 `it()` blocks
  (~60-70 lines) with identical assertion coverage per threat.

## Phase 3 — small cross-file duplicate (trainer-team / storage-pc)

`getMemberAbilityName` (maps a Pokémon's assigned ability to its i18n name
key, or `null`) is a one-line pass-through to
`abilityService.getMemberAbility(pokemon)?.name ?? null` in both
`TrainerTeamComponent` and `StoragePcComponent`, and both specs assert the
identical `sturdy` → `'abilities.sturdy.name'` / no-ability → `null` case:

- `src/app/trainer-team/trainer-team.component.spec.ts:99-103` (also covers
  an `undefined` input case the storage-pc version doesn't)
- `src/app/trainer-team/storage-pc/storage-pc.component.spec.ts` — currently
  at **line 192-195** (`it('getMemberAbilityName returns the ability i18n
  name key (or null)', ...)`; re-`grep -n` to confirm before editing, this
  file has been edited since the audit for an unrelated PC-lockout feature
  and line numbers may have moved again)

**Action:** delete the `storage-pc.component.spec.ts` copy (the
`trainer-team.component.spec.ts` version is the one to keep — it has strictly
more coverage, the `undefined` case). Do not touch
`trainer-team.component.spec.ts`.

### Phase 3 acceptance

- `npm run test:local` passes, full suite.

## Explicitly out of scope (audited, found clean — do not touch)

- `run-persistence.service.spec.ts` (914 lines) — one legitimate
  save/restore/legacy-default triplet per persisted field, matches the
  current `SavedRun` interface field-for-field.
- `stats.service.spec.ts` / `stats-selectors.spec.ts` / `achievements.spec.ts`
  — different layers (mutation vs. derived-value computation vs. per-
  achievement predicate), no overlapping assertions.
- All Pokémon/trainer data-service specs (trainer, type-matchup,
  type-matchups-data, pokedex, ability, evolution, pokemon-forms, pokemon,
  items, badges) — each split (e.g. `apply-type-bias.spec.ts` vs.
  `trainer.service.spec.ts`) tests a genuinely distinct layer.
- The ~30 small roulette-leaf specs and ~13 tiny shell/settings/button specs
  — structurally similar by design (each backs a distinct component/route)
  but not duplicated in content.
- `trainer-team.component.spec.ts`'s and `storage-pc.component.spec.ts`'s
  "marked badge" tests — same `it()` titles, but assert against two
  genuinely different DOM regions (team roster strip vs. PC-modal team
  loop), each independently rendered. Not a duplicate.

## Checklist

- [x] Phase 1 — battle roulette spec dedup (1a-1d)
- [x] Phase 2 — `roulette-container.component.spec.ts` merge pairs (1-7)
- [ ] Phase 3 — `getMemberAbilityName` cross-file duplicate
- [ ] Full suite green after each phase
- [ ] Move this file to `docs/plans/done/` once all three phases ship
