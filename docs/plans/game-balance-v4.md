# Plan: Game balance V4 — Depth & stakes

Status: **Draft — two pieces need your sign-off before implementation starts**
(flagged inline: the ability shortlist in Part A, and the revive-cost numbers
in Part B). Everything else — faint scope, faint-state, feature-flag reuse —
is settled. 5 phases once signed off, checkpoint after each.
Owner: tormarod
Last updated: 2026-07-18
Rationale + roadmap: `docs/research/game-balance-research.md` (§ "V4 — Depth &
stakes"). Depends on V3 (`docs/plans/game-balance-v3.md`) — reuses its
`newBalanceMode` flag and its lead-pick (the lead is "the mon at risk" here).

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
4. **Reuses V3's `newBalanceMode` flag** — no second toggle. Abilities and the
   faint mechanic only exist when the player has opted into New Balance.

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

## Open item 1 (needs your sign-off): the ability shortlist

You said: *"the most iconic ability for each type, and maybe some common/normal
ones."* One iconic ability per type (18 types — see
`src/app/interfaces/pokemon-type.ts`) would be ~18-21 abilities, well past the
roadmap's own framing ("small, curated... NOT the full list... narrow so each
is legible and tunable"). Rather than pick a number unilaterally, here's a
draft that tries to honor your intent while staying legible: **8 distinct
numeric effects**, each flavored as 1-3 named, type-iconic abilities attached
to specific curated species (not "every Fire-type gets Blaze" — one hand-picked
species per flavor, the same curated-not-blanket approach the roadmap already
uses for gym leaders). This keeps the tunable surface at 8, not 18+, while
still touching most types through flavor text. **Review this table — add,
cut, reflavor, or tell me to actually do all 18 distinct-effect abilities
instead; nothing below is final:**

| Effect (the tunable numeric part) | Flavor / attached species (`pokemonId`) | Numeric effect |
|---|---|---|
| Offense surge | Blaze (Charizard), Torrent (Blastoise), Overgrow (Venusaur) | If this mon's signed delta is positive, add **+2 Yes** on top (stacks with V3's lead-double if it's also the lead) |
| Damage soak | Thick Fat (Snorlax), Multiscale (Dragonite) | If this mon's signed delta is negative, **-2 No** (floored at the existing per-battle `baseNoCount`, never negative) |
| Unbreakable | Sturdy (Golem/Onix) | If this mon is the lead and would cause a faint (V4 Part B), the faint is **negated once per battle** — the mon survives at "critical HP" (flavor only, no extra mechanic) |
| Status immunity | Levitate (Gengar/Rotom) | This mon's own negative delta (if any) is **zeroed**, not just doubled/left alone — full immunity to its worst matchup |
| Team synergy | Trace (Gardevoir), Synchronize (Umbreon) | **+1 Yes** per teammate that shares a type with this mon (own type included), flat |
| Precision | Serene Grace (Togekiss) | **+1 to `retries`** for free, once, the first time this mon's battle would otherwise be lost (does not require a potion) |
| Intimidation | Intimidate (Gyarados/Arcanine) | Flat **+1 Yes**, always, no condition — the "common/normal" catch-all pick |
| Iron wall | Clear Body / Sand Stream flavor (Metagross/Tyranitar) | **-1 No**, always, no condition — the other "common" catch-all pick |

- New file: `src/app/services/ability-service/abilities-data.ts` —
  `Record<number /* pokemonId */, AbilityName>`, one entry per curated species
  above (not a per-type blanket table).
- New file: `src/app/services/ability-service/ability.service.ts` —
  `getAbility(pokemonId): AbilityDefinition | undefined`; `applyTeamAbilities(team, opponentTypes, leadIndex): { yesBonus: number; noBonus: number; extraRetry: boolean }`
  folding in every team member's ability effect (not just the lead's — only
  "Precision"/"Unbreakable" above are lead-specific by design, the rest apply
  per-member same as the base matchup math).
- Hook point: `BaseBattleRouletteComponent.buildVictoryOdds` gets a third New
  Balance-only addend, applied only when `gameStateService.isNewBalanceMode`
  (Classic mode: abilities don't exist, full stop — no species has an ability
  in Classic mode regardless of what's in `abilities-data.ts`).
- Display: extend `MatchupStripComponent` (or add a small adjacent badge) to
  show which teammate(s) have an active ability this battle — legibility
  matters more here than anywhere else in the plan, since an invisible +2 Yes
  reads as an unexplained wheel that "feels off."

## Open item 2 (needs your sign-off): revive cost numbers

You asked me to resolve the potion/retry-vs-revive overlap — resolved above
(separate Revive item, decision #3). What's still open is the **cost curve**:
how many Revives (and does tier matter) to bring back a fainted mon. Proposal,
flag if you want different numbers:

- **Single tier, no scaling by power.** One `revive` item, one use, revives
  regardless of the fainted mon's power. Simpler than tiering by power (which
  would need 2-3 new item variants, e.g. `revive`/`max-revive`, mirroring the
  potion tiers) — but power-tiering was explicitly the direction you leaned
  toward when you first raised the healing-economy-payoff angle. **Pick one:**
  - (a) Single tier as above — less new surface, one item to add.
  - (b) Tiered like potions: `revive` (power 1-4), `max-revive` (power 5-8) —
    mirrors the potion-tier pattern exactly, more new surface (2 items, 2
    weights, 2×6-locale i18n entries) but ties revival cost to what's actually
    at risk, matching the "healing economy pays off" framing from the
    roadmap.

File either way: `src/app/services/items-service/items-data.ts` (new
`RegularItemName` entr(y/ies)), `regular-item-names.ts`,
`item-sprite-service/item-sprite.service.ts` (sprite URL), 6×
`src/assets/i18n/*.json` (name + description). Suggested starting weight in
the `find-item` roster: rarer than `hyper-potion` (`0.25`) — e.g. `0.15` —
since this is meant to be the scarce, high-stakes economy V1 set up healing
scarcity for. `⚙️` tune after playtest, same as V1's dials.

---

# Part A — Abilities (curated set)

See the table and hook-point above. Implementation, once the table is
confirmed:

1. `abilities-data.ts` + `ability.service.ts` (pure logic, no UI).
2. Unit tests per effect: one team-member fixture per row of the table,
   asserting the exact numeric delta the service produces.
3. Wire into `buildVictoryOdds` (New Balance only).
4. UI badge in the battle screens.

# Part B — Faint / revive mechanic

## B1. `PokemonItem.fainted` flag

File: `src/app/interfaces/pokemon-item.ts` — add `fainted?: boolean` (optional,
defaults falsy for every existing Pokémon everywhere, no migration needed).

## B2. Faint on a qualifying loss

File: `src/app/main-game/roulette-container/roulette-container.component.ts`

`rivalBattleResult(false)` (line 750) is the concrete hook for now (see
"Which battles get the faint mechanic" above). Only when
`gameStateService.isNewBalanceMode`:

1. Read the committed lead from `battlePrepService.getPendingPrep()`
   (`leadIndex`, resolved during V3's prep step for this same battle — read it
   **before** calling `battlePrepService.clearPrep()`).
2. `const [faintedMon] = this.trainerService.getTeam().splice(leadIndex, 1);`
   equivalent via whatever team-mutation method `TrainerService` already
   exposes for moving a member out of the team array (reuse the same
   remove-from-team primitive `stealPokemon`'s flow uses, if one exists as a
   named method — check `trainer.service.ts` for the team-mutation used by
   Team Rocket's steal before adding a new one; don't duplicate that logic).
3. Set `faintedMon.fainted = true`, then move it into storage via
   `trainerService.commitTeamAndStorage(updatedTeam, [...storedPokemon, faintedMon])`
   — reuses exactly the plumbing `StoragePcComponent.drop()` already uses
   (`src/app/trainer-team/storage-pc/storage-pc.component.ts:130-142`), so no
   new persistence wiring is needed: `storedPokemon` is already in `SavedRun`.
4. Show a modal ("X fainted!") before continuing to `doNothing()`.
5. If the team is now empty (`trainerTeam.length === 0` — the fainted mon was
   the last one), this cannot be treated as a normal "continue" — treat it as
   a loss/game-over the same way an empty team is presumably already handled
   elsewhere (check `TrainerService`/`GameStateService` for an existing
   empty-team guard before assuming one needs to be added; V1/V2 didn't touch
   this edge case so it may not exist yet — if it doesn't, this is the moment
   to add a minimal one, scoped to New Balance mode only).

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

**Do not start implementation until Open items 1 and 2 above are confirmed.**

1. **Sign-off checkpoint (not code).** Confirm the ability table (or ask for
   the full 18) and the revive-cost approach ((a) or (b)).
2. **Abilities (Part A).** `abilities-data.ts` + `ability.service.ts` + unit
   tests per effect + `buildVictoryOdds` wiring + UI badge. *Checkpoint: each
   curated species' effect is visible and numerically correct in New Balance
   mode; zero effect in Classic mode.*
3. **Revive item(s) (Open item 2's file list).** Add to items-data, sprites,
   i18n (6 locales), `find-item` roster weight. *Checkpoint: item appears,
   correct rarity, correct description.*
4. **Faint mechanic (Part B).** `PokemonItem.fainted`, `rivalBattleResult`
   wiring, `StoragePcComponent` revive UI + drag-drop guard, empty-team edge
   case. *Checkpoint: a rival loss in New Balance mode faints the committed
   lead, frees the team slot, shows the fainted mon greyed-out in the PC, and
   Revive brings it back; a Classic-mode rival loss is untouched (still just
   `doNothing()`).*
5. **Docs.** README feature entry (stakes/depth section). Update this file's
   status; move to `docs/plans/done/` once phases 2-4 are all shipped and
   `docs/plans/game-balance-v3.md` has also been moved (V4 assumes V3 is
   live).

## Validation

- `npm run test:local` green throughout.
- Persistence test: faint a mon, reload mid-storage-view, confirm it's still
  greyed-out/un-revived (no re-roll of the faint via reload).
- Manual playtest: run a rival battle to a loss in New Balance mode with a
  known lead; confirm exactly that mon lands in the PC fainted; buy/find a
  Revive and confirm it returns to a normal, usable stored Pokémon.
- Re-run V1/V2's manual playtest checklist in **Classic mode** to confirm zero
  regression — abilities, faint, and Revives must not exist at all when
  `newBalanceMode` is off.

## Explicitly out of scope (this plan)

- Re-tuning V2's Danger meter / reward-threat pools for the new rival stakes —
  flagged as a known follow-up in V2's own plan file; do it after this ships
  and V2 Part A exists, not speculatively now.
- Extending abilities or faint to gym/Elite Four/Champion — explicitly ruled
  out by "gyms stay pure" and the "already game-over, nothing to faint into"
  reasoning above. If this is ever revisited, it's a new decision, not a
  gap in this plan.
