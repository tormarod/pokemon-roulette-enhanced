# Plan: Game balance V4 — Depth & stakes

Status: **Done — all 5 phases shipped.** Both sign-off items were resolved
2026-07-18: ability shortlist → full 18 (one per type, table below expanded
from the original 8-effect draft); revive cost → single tier, no power
tiering.
Owner: tormarod
Last updated: 2026-07-18
Rationale + roadmap: `docs/research/game-balance-research.md` (§ "V4 — Depth &
stakes"). Depends on V3 (`docs/plans/game-balance-v3.md`) — reuses its
`newExperienceMode` flag and its lead-pick (the lead is "the mon at risk" here).

## Decisions locked in (from user Q&A, 2026-07-18)

1. **Faint is guaranteed, not probabilistic**, on every loss it applies to. No
   second RNG layer on top of the wheel spin.
2. **A fainted Pokémon is freed from the team immediately** (opens a team
   slot) rather than staying on the team as a dead weight slot. With no
   healing on hand, the slot just stays empty until the player finds/buys a
   Revive — never an instant additional loss beyond the freed slot.
3. **Revive is a new, separate item** — distinct from the potion/retry pool.
   Reusing potions for both retries and revives was explicitly rejected: it
   would let a bad run of retry-spending silently leave the player unable to
   revive right after, which reads as an unintended trap rather than a real
   choice.
4. **Reuses V3's `newExperienceMode` flag** — no second toggle. Abilities and the
   faint mechanic only exist when the player has opted into New Experience.

## Which battles get the faint mechanic (derived, not asked — see below)

The roadmap says "between-gym battles only, never gym battles," listing
"rival/trainer/Team-Rocket-style" as the target and contrasting with gyms. It
doesn't explicitly mention Elite Four/Champion, so here's the reasoning that
resolves it from the current code rather than guessing:

- **Today**, a loss already ends the run outright (`game-over`) for gym,
  Elite Four, **and** Champion battles — `retries` from potions is the only
  cushion, and once that's exhausted the run is over. There is no "continue
  with a fainted mon" scenario for these three: the run doesn't continue.
- **Rival battles are the odd one out**: today, `rivalBattleResult(false)`
  (`roulette-container.component.ts:750`) has **zero cost** — it just calls
  `doNothing()` and the run continues untouched. This is exactly the "reward
  wheel this loss should have real stakes" gap V4 fixes.
- So: **the faint mechanic applies to rival battles**, and to whatever
  Team-Rocket-style dual-nature threats V2 Part A eventually adds (per V2's
  own forward note about rival/trainer becoming dual-nature). **Gym, Elite
  Four, and Champion keep their exact current behavior** — a loss there still
  ends the run; nothing to faint into.
- If/when V2 Part A lands and adds real "trainer battle" encounters with a
  loss branch, wire faint into their result handler the same way as A2 below.
  Nothing to design now — just don't treat this list as exhaustive forever.

## Resolved: the ability shortlist (2026-07-18)

You picked the full 18 (one per type) over the original 8-effect draft. Final
table, as implemented in `src/app/services/ability-service/abilities-data.ts`:

| Type | Species (`pokemonId`) | Ability | Numeric effect |
|---|---|---|---|
| Normal | Snorlax (143) | Thick Fat | Flat **-1 No** |
| Fighting | Machamp (68) | No Guard | Flat **+1 Yes** |
| Flying | Staraptor (398) | Keen Eye | Flat **-1 No** |
| Poison | Nidoking (34) | Poison Point | Flat **+1 Yes** |
| Ground | Garchomp (445) | Rough Skin | If delta positive: **+1 Yes** |
| Rock | Golem (76) | Sturdy | If lead: negate one faint per battle (Part B) |
| Bug | Scizor (212) | Swarm | If delta positive: **+1 Yes** |
| Ghost | Gengar (94) | Levitate | Zero this mon's own negative delta |
| Steel | Metagross (376) | Clear Body | Flat **-1 No** |
| Fire | Charizard (6) | Blaze | If delta positive: **+2 Yes** |
| Water | Blastoise (9) | Torrent | If delta negative: **-2 No** |
| Grass | Venusaur (3) | Overgrow | If delta positive: **+2 Yes** |
| Electric | Zapdos (145) | Static | Flat **+1 Yes** |
| Psychic | Gardevoir (282) | Synchronize | **+1 Yes** per teammate sharing a type (self included) |
| Ice | Glaceon (471) | Snow Cloak | Flat **-1 No** |
| Dragon | Dragonite (149) | Multiscale | If delta negative: **-2 No** |
| Dark | Mightyena (262) | Intimidate | Flat **+1 Yes** |
| Fairy | Togekiss (468) | Serene Grace | **+1 free retry**, granted once per battle instance |

Implementation notes vs. the original draft:
- `applyTeamAbilities(team, opponentTypes)` — dropped the `leadIndex` param
  from the draft signature; unused since only Sturdy is lead-specific, and
  that's handled separately by the faint mechanic via `getAbility()` directly
  on the lead, not through `applyTeamAbilities`.
- Serene Grace's free retry is granted the first time `buildVictoryOdds` runs
  with the ability present (`Math.max(this.retries, 1)`, guarded by a
  once-per-battle-instance flag) rather than strictly "the first time this
  mon's battle would otherwise be lost." Functionally very close — the retry
  is simply available from the start of the battle instead of materializing
  only at the moment of an otherwise-losing spin — chosen to avoid new
  modal/UI plumbing across all 4 battle components for a small mechanic.

## Resolved: revive cost numbers (2026-07-18)

Single tier, no power scaling — option (a). One `revive` item, one use,
revives regardless of the fainted mon's power. Weight `0.15` in
`items-data.ts` (rarer than `hyper-potion`'s `0.25`). Additionally gated:
`ItemsService.getRegularItems()` excludes `revive` unless
`gameStateService.isNewExperienceMode` — a Revive is meaningless without the
faint mechanic, so Classic mode never finds it (not explicitly speced in the
original plan, but a direct consequence of "New Experience only").

---

# Part A — Abilities (curated set)

See the resolved table above. Implemented in full:

1. `abilities-data.ts` + `ability.service.ts` (pure logic, no UI).
2. Unit tests per effect: one team-member fixture per row of the table,
   asserting the exact numeric delta the service produces (`ability.service.spec.ts`).
3. Wired into `buildVictoryOdds` (New Experience only) — floors the No count
   at `baseNoCount` per the original draft's soak-effect note.
4. UI badge: `MatchupStripComponent` gained an `abilityNames` input, wired
   into all 4 battle screens (gym, rival, Elite Four, Champion).

# Part B — Faint / revive mechanic

## B1. `PokemonItem.fainted` flag

File: `src/app/interfaces/pokemon-item.ts` — add `fainted?: boolean` (optional,
defaults falsy for every existing Pokémon everywhere, no migration needed).

## B2. Faint on a qualifying loss

**Deviation from the original plan, found during implementation:** the plan's
stated hook, `rivalBattleResult(false)` in `roulette-container.component.ts`,
runs *after* `RivalBattleRouletteComponent.onItemSelected` has already called
`battlePrepService.clearPrep()` — so `leadIndex` is gone by the time
`rivalBattleResult` would run. The faint logic was implemented instead in
`RivalBattleRouletteComponent.onItemSelected`'s loss branch (the `else` where
retries are exhausted and no potion is available), **before** `clearPrep()`
runs there. As implemented:

1. `applyFaintOnLoss()` (private method on `RivalBattleRouletteComponent`)
   reads `battlePrepService.getPendingPrep()?.leadIndex` before `clearPrep()`.
2. Checks `abilityService.getAbility(lead.pokemonId)?.effect === 'faint-immune-lead'`
   first (Sturdy) — if true, returns without fainting anything.
3. Splices the lead out of `trainerService.getTeam()`, sets `fainted = true`,
   and commits via `trainerService.commitTeamAndStorage(updatedTeam, [...stored, faintedMon])`
   — same plumbing `StoragePcComponent.drop()` uses.
4. Opens a "fainted!" modal (`faintedModal` template, new i18n key
   `game.main.roulette.rival.fainted`).
5. Empty-team edge case: implemented in `RouletteContainerComponent.rivalBattleResult(false)`
   instead (it runs after the child's `battleResultEvent.emit(false)`, so the
   team mutation from step 3 has already landed by the time it checks
   `trainerService.getTeam().length === 0`). No prior empty-team guard existed
   in `TrainerService`/`GameStateService`, so this is a new addition, gated to
   `gameStateService.isNewExperienceMode`, mirroring gym/Elite Four/Champion's
   existing `recordRunEnd` + `setNextState('game-over')` pattern.

## B3. Revive UI — `StoragePcComponent`

File: `src/app/trainer-team/storage-pc/storage-pc.component.ts` / `.html`

- A stored Pokémon with `fainted === true` renders with a visibly distinct
  state (greyed sprite / "Fainted" badge) and is **not draggable back into the
  team** (extend the existing `drop()` guard / a new `canDrop` predicate)
  until revived.
- Add a "Revive" button on a fainted entry, shown only if
  `trainerService.hasItem('revive')` (or the tiered equivalent from Open item
  2). On click: consume the item (`trainerService.removeItem(...)`), clear
  `fainted`, done — the mon is now a normal stored Pokémon, draggable back into
  the team via the existing drag-drop.
- No healing on hand: the button is simply absent/disabled; the mon sits in
  storage, taking a slot there but not blocking anything else, exactly like
  decision #2 specifies.

## B4. Persistence

No new `SavedRun` fields needed — `fainted` rides inside `storedPokemon`
entries, which are already persisted in full (`SavedRun.storedPokemon`,
`RunPersistenceService`). Verify `isValidSavedRun`'s `Array.isArray(run.storedPokemon)`
check still passes with the new optional field (it will — no schema
tightening there).

---

## Phases (checkpoint after each; `npm run test:local` green each time)

All 5 phases shipped 2026-07-18.

1. ✅ **Sign-off checkpoint (not code).** Full 18 abilities, single-tier revive.
2. ✅ **Abilities (Part A).** `abilities-data.ts` + `ability.service.ts` (20
   unit tests) + `buildVictoryOdds` wiring + `MatchupStripComponent` badge
   across all 4 battle screens.
3. ✅ **Revive item.** `items-data.ts` (weight `0.15`), sprite, i18n ×6,
   `ItemsService.getRegularItems()` gated to New Experience mode.
4. ✅ **Faint mechanic (Part B).** `PokemonItem.fainted`, faint wired into
   `RivalBattleRouletteComponent.onItemSelected` (see deviation note above,
   not `rivalBattleResult`), `StoragePcComponent` revive UI + drag-disable,
   empty-team → game-over edge case in `RouletteContainerComponent.rivalBattleResult`.
5. ✅ **Docs.** README "Abilities & the faint mechanic" section added; this
   file moved to `docs/plans/done/`.

## Validation

- `npm run test:local` green throughout.
- Persistence test: faint a mon, reload mid-storage-view, confirm it's still
  greyed-out/un-revived (no re-roll of the faint via reload).
- Manual playtest: run a rival battle to a loss in New Experience mode with a
  known lead; confirm exactly that mon lands in the PC fainted; buy/find a
  Revive and confirm it returns to a normal, usable stored Pokémon.
- Re-run V1/V2's manual playtest checklist in **Classic mode** to confirm zero
  regression — abilities, faint, and Revives must not exist at all when
  `newExperienceMode` is off.

## Explicitly out of scope (this plan)

- Re-tuning V2's Danger meter / reward-threat pools for the new rival stakes —
  flagged as a known follow-up in V2's own plan file; do it after this ships
  and V2 Part A exists, not speculatively now.
- Extending abilities or faint to gym/Elite Four/Champion — explicitly ruled
  out by "gyms stay pure" and the "already game-over, nothing to faint into"
  reasoning above. If this is ever revisited, it's a new decision, not a
  gap in this plan.
