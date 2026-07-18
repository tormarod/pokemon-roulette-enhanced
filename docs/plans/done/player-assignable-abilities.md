# Player-Assignable Abilities (New Experience Mode)

**Status: ✅ COMPLETE — all 4 phases shipped. Full suite 741 green; prod build clean.**

Turn abilities from a passive, species-locked stat into a player-driven system: you loot
ability capsules from the adventure wheel and assign them to your Pokémon from the PC/team
detail screen.

## Decisions locked (from planning session)

1. **Acquisition:** looted consumable items, one specific ability per item ("Capsule: Blaze").
2. **Replaces species abilities entirely:** Pokémon start with NO ability. The species→ability
   table (`abilitiesData` keyed by `pokemonId`) is deleted. Existing saves simply lose their
   passive abilities (acceptable — the field is optional and defaults to none).
3. **Roster:** a medium, flat (~16–18) set, all equally available as drops.
4. **UI location:** the team/PC Pokémon detail surface (`storage-pc` component).
5. **Permanence:** re-assignable; applying a capsule overwrites the current ability and consumes
   the capsule.
6. **Faint stakes preserved:** the faint-immune (Sturdy) effect stays as an assignable ability.
7. **Scope: New Experience Mode ONLY — the whole feature.** Not just the battle math (as today),
   but *every* surface: capsules never drop, the capsule wheel is never reachable, and the
   assign/badge UI never renders when `gameStateService.isNewExperienceMode` is false. See the
   gating checklist below — it is a hard acceptance requirement for every phase.

## New Experience gating checklist (applies to ALL phases — hard requirement)

Guard on `gameStateService.isNewExperienceMode` (the same flag the current ability math and Revive
use). Nothing about this feature may appear or function in Classic mode:

- **Battle math (Phase 1):** already guarded at `base-battle-roulette.component.ts:144`; keep it.
- **Acquisition (Phase 2):** the `findAbilityCapsule` candidate goes ONLY in the New Experience
  `rewardPool`, never `baseActions`. `getAbilityCapsules()` is only consumed by the
  New-Experience-only capsule wheel. Do NOT add capsules to `getRegularItems()`.
- **Assignment + badge UI (Phase 3):** the ability badge and the Assign control render only when
  `isNewExperienceMode`. In Classic, `storage-pc` looks exactly as it does today.
- **Data field:** `PokemonItem.ability` may exist on the object in any mode (it just round-trips),
  but it is only ever *read* behind the New Experience guard, so a Classic run ignores it.
- **Acceptance (every phase):** a Classic-mode run shows no capsules, no capsule wheel, no ability
  badge, no assign control, and identical battle odds to before this feature.

## UI / theming requirements (applies to ALL new UI — hard requirement)

Every new or changed UI surface (ability badge, Assign control, capsule picker, capsule wheel,
explainer modals) MUST work in all three themes, and be readable and well-positioned in each:

- **Themes are body classes** set by `ThemeService` (`theme.service.ts`): `theme-starters`
  (dark, tiled background image), `theme-plain-dark` (dark), `theme-plain-light` (light). Rules
  in `styles.css:19-34`. There is NO auto light/dark via `prefers-color-scheme` — you must handle
  each theme class explicitly. Do not hardcode a single text/background color that only reads on
  dark (e.g. light text on a transparent badge vanishes on `theme-plain-light`).
- **Readable in every theme:** pick colors with adequate contrast against each theme's background
  (`#2d3436` dark / `#dfe6e9` light). Mirror the existing `fainted-badge` treatment in
  `storage-pc` — it already sits on Pokémon cards legibly across themes; reuse that pattern for the
  ability badge rather than inventing new colors.
- **Angular encapsulation gotcha (documented in `styles.css:36-56`):** a component-scoped
  `body.theme-x .my-selector { ... }` rule **silently never matches** — Angular's emulated
  encapsulation appends a scoping attribute to every selector segment including the `body`
  ancestor, which `<body>` never carries. So any theme-conditional styling for the new UI must go
  in the **global `styles.css`** (unscoped), exactly like the existing `.share-card` theme rules
  there. Non-theme-conditional styling can stay in the component stylesheet.
- **Well-positioned:** the badge and Assign control must not overlap the sprite, the drag handle,
  the fainted badge, or the type-icon tooltip on a `storage-pc` card, and must not break the
  `cdkDropList` drag-and-drop hit areas. Verify on a full 6-member team and in the PC grid, at the
  modal's normal width, in all three themes.
- **Acceptance (Phase 2 & 3):** manually confirm each new surface in all three themes (switch via
  the in-app theme selector) — text legible, controls not clipped/overlapping, drag-and-drop still
  works.

## Effect-engine decision (RESOLVED)

The 18 base abilities (§4a) ride entirely on the existing 8 proven effect kinds — zero balance
risk. On top of that, **12 more abilities (§4b + §4c) introduce 9 brand-new effect mechanics**
(engine change), bringing the roster to **30**. The base 18 are locked; the 12 new-mechanic ones
need final sign-off (§4b, §4c). All new mechanics use only data already available inside
`applyTeamAbilities` (`team`, `member`, `opponentTypes`, per-member `delta`) — no new
plumbing/params.

---

## Current system (so an execution session needn't re-research)

- **Ability data** — `src/app/services/ability-service/abilities-data.ts`. `abilitiesData:
  Record<number, AbilityDefinition>` keyed by National Dex `pokemonId`. 18 hand-picked species,
  one per type. `AbilityDefinition = { name: string; type: PokemonType; effect: AbilityEffectType;
  value: number }`. `name` is a **hardcoded English literal** (no i18n today). `AbilityEffectType`
  is the 8-member union above.
- **Ability service** — `src/app/services/ability-service/ability.service.ts`.
  - `getAbility(pokemonId): AbilityDefinition | undefined` → `abilitiesData[pokemonId]` (line 13).
  - `applyTeamAbilities(team, opponentTypes)` (line 33) folds every member's effect into
    `{ yesBonus, noBonus, extraRetry }`, reading `getAbility(member.pokemonId)` (line 42).
- **Battle wiring** — `base-battle-roulette.component.ts` (shared base for gym/rival/elite-four/
  champion):
  - line 144: guarded by `isNewExperienceMode`.
  - line 145-147: `activeAbilityNames = trainerTeam.map(m => getAbility(m.pokemonId)?.name)` →
    passed to `<app-matchup-strip [abilityNames]="activeAbilityNames">`.
  - line 148: `applyTeamAbilities(this.trainerTeam, types)` → yes/no bonuses + `extraRetry`.
- **Faint check** — `rival-battle-roulette.component.ts:115`:
  `if (this.abilityService.getAbility(lead.pokemonId)?.effect === 'faint-immune-lead')`.
- **Matchup badge** — `matchup-strip.component.ts:22` `@Input() abilityNames: string[]`, rendered
  at `matchup-strip.component.html:39-43`. Purely presentational.
- **PokemonItem** — `src/app/interfaces/pokemon-item.ts`. Fields: `pokemonId, type1, type2,
  sprite, shiny, power, fainted?`. No ability field today.
- **Item model** — `ItemItem extends WheelItem { name: ItemName; sprite: string; description:
  string }` (`item-item.ts`); `WheelItem` adds `text, fillStyle, weight`. `RegularItemName` is a
  14-member union (`regular-item-names.ts`); `itemsData: Record<RegularItemName, ItemItem>`
  (`items-data.ts`, exhaustive). Mega stones are a **parallel** table with their own name union
  (`MegaStoneItemName`) and data (`megaStonesData`); `ItemName = RegularItemName |
  MegaStoneItemName`. `text`/`description` are i18n keys (`items.<name>.name`/`.description`).
- **Item drops** — `find-item-roulette.component.ts` spins over `itemService.getRegularItems()`
  (`Object.values(regularItemsData)`, revive filtered to New Experience), each `ItemItem.weight`
  sizes its slice; emits `itemSelectedEvent: EventEmitter<ItemItem>`. Reached from the adventure
  wheel: `main-adventure-roulette.component.ts` New Experience `rewardPool` has a `findItem`
  candidate (line ~107) drawn via `drawDistinct()`; routed through `actionHandlers` (line ~138) →
  `findItemEvent`; `roulette-container` calls `addToItems(getItem(itemName))`.
- **Item-use / target-a-Pokémon pattern** — Rare Candy is the template:
  `roulette-container.chooseWhoWillEvolve()` sets `auxPokemonList` + `auxPokemonListPickMode`,
  `setNextState('evolve-pokemon')`; the picker returns via `continueWithPokemon(pokemon)` which
  `switch`es on `currentGameState`. GameState union: `src/app/services/game-state-service/
  game-state.ts`.
- **Team/PC detail UI** — `src/app/trainer-team/storage-pc/storage-pc.component.{ts,html}`. Modal
  with two `cdkDropList` grids (`trainerTeam`, `storedPokemon`). Per card: sprite + tooltip
  (`text`, `power`, type icons via `getPokemonTypes()`). Fainted cards get `fainted-badge` +
  Revive button → `revivePokemon(pokemon)` which `removeItem(revive)`, `pokemon.fainted = false`,
  `commitTeamAndStorage(...)`. **This is the exact template for the ability badge + assign button.**
- **Persistence** — `run-persistence.service.ts`. `SavedRun` holds `trainerTeam: PokemonItem[]`,
  `storedPokemon: PokemonItem[]`, `trainerItems: ItemItem[]`, etc. Save = `JSON.stringify(run)`
  (no field whitelist). Restore = `JSON.parse` + `isValidSavedRun` (only checks `Array.isArray`
  at top level, never inspects item/pokemon inner fields) → `commitTeamAndStorage`, `restoreItems`.
  **A new optional `PokemonItem.ability` field and a new capsule item in the bag round-trip
  automatically — no persistence changes required.** No versioning; backward compat via `??`.

---

## §4a — Base roster: 18 abilities on existing effects (LOCKED)

All effects are existing, already-balanced kinds. `type` is display/flavor only (badge color,
capsule slice color). Names/descriptions become i18n keys `abilities.<id>.name` / `.description`.

| id | Name | type (flavor) | effect | value | What it does |
|----|------|---------------|--------|-------|--------------|
| `blaze` | Blaze | fire | offense-if-positive | 2 | +2 Yes when this member has a type advantage |
| `torrent` | Torrent | water | soak-if-negative | -2 | -2 No when this member is at a type disadvantage |
| `overgrow` | Overgrow | grass | offense-if-positive | 2 | +2 Yes when advantaged |
| `guts` | Guts | fighting | flat-yes | 2 | +2 Yes, always |
| `static` | Static | electric | flat-yes | 1 | +1 Yes, always |
| `poison-point` | Poison Point | poison | flat-yes | 1 | +1 Yes, always |
| `intimidate` | Intimidate | dark | flat-no | -1 | -1 No, always (defensive) |
| `thick-fat` | Thick Fat | normal | flat-no | -1 | -1 No, always |
| `clear-body` | Clear Body | steel | flat-no | -1 | -1 No, always |
| `keen-eye` | Keen Eye | flying | flat-no | -1 | -1 No, always |
| `snow-cloak` | Snow Cloak | ice | flat-no | -1 | -1 No, always |
| `multiscale` | Multiscale | dragon | soak-if-negative | -2 | -2 No when disadvantaged |
| `levitate` | Levitate | ghost | zero-own-negative | 0 | Cancels this member's own type disadvantage |
| `swarm` | Swarm | bug | offense-if-positive | 1 | +1 Yes when advantaged |
| `rough-skin` | Rough Skin | ground | offense-if-positive | 1 | +1 Yes when advantaged |
| `synchronize` | Synchronize | psychic | team-synergy | 1 | +1 Yes per team member sharing a type |
| `sturdy` | Sturdy | rock | faint-immune-lead | 0 | Lead survives a would-be rival faint once/battle |
| `serene-grace` | Serene Grace | fairy | extra-retry | 0 | Grants one extra battle retry |

18 abilities. This is essentially the current 18, re-homed as species-independent + Intimidate
flipped to defensive + Guts added as a pure-offense option. **LOCKED — approved.**

## §4b — Extension: 5 abilities on NEW mechanics (NEEDS SIGN-OFF)

Five new `AbilityEffectType` members + their switch-cases (exact code in Phase 1). Each uses only
`team` / `member` / `delta`, already in scope. Roster total → **23**.

| id | Name | type | new effect | value | Behavior |
|----|------|------|-----------|-------|----------|
| `reckless` | Reckless | fire | `double-edged` | 1 | +1 Yes **and** +1 No — pure variance, net-neutral in expectation |
| `battle-armor` | Battle Armor | steel | `defensive-synergy` | 1 | -1 No per team member sharing a type (defensive mirror of Synchronize) |
| `justified` | Justified | fighting | `punish-disadvantage` | 2 | +2 Yes when this member is at a type *disadvantage* (turns a bad matchup aggressive) |
| `last-stand` | Last Stand | dragon | `low-team-offense` | 2 | +2 Yes while your team has ≤2 members (desperation buff) |
| `adaptability` | Adaptability | normal | `neutral-bonus` | 1 | +1 Yes when this member's matchup is exactly neutral (delta == 0, opponent types present) |

**Balance notes (for playtest):**
- `double-edged` is symmetric (equal Yes/No), so it's variance-only, not a power creep.
- `defensive-synergy` mirrors the existing `team-synergy` magnitude (value 1) on the No axis; the
  `rawNoCount` floor at `baseNoCount` (`base-battle-roulette.component.ts:185-187`) still caps it.
- `punish-disadvantage` and `neutral-bonus` are mutually exclusive with `offense-if-positive`'s
  trigger (they fire on the *other* matchup states), keeping any single ability from double-dipping.
- `last-stand` only rewards a shrunk team (late-run / post-faint), so it can't stack early.

**User: confirm these 5 (mechanics, names, values), edit, or swap any out.**

## §4c — Extension 2: 7 more abilities to reach 30 (NEEDS SIGN-OFF)

Four more new mechanics (two symmetric pairs) + three on existing effects. Roster total → **30**.
The scaling mechanics are **capped by `value`** so they can never produce an unbounded swing.

| id | Name | type | effect | value | Behavior |
|----|------|------|--------|-------|----------|
| `versatile` | Versatile | dragon | `dual-type-offense` (new) | 1 | +1 Yes if this member is dual-typed (`type2` present) |
| `pure-power` | Pure Power | fighting | `mono-type-offense` (new) | 1 | +1 Yes if this member is single-typed (no `type2`) |
| `sheer-force` | Sheer Force | ground | `scale-with-advantage` (new) | 3 | +Yes equal to the member's advantage, capped at 3 (snowball when ahead) |
| `comeback` | Comeback | dark | `scale-with-disadvantage` (new) | 3 | +Yes equal to how bad the matchup is, capped at 3 (rally when behind) |
| `marvel-scale` | Marvel Scale | water | `soak-if-negative` (existing) | -1 | -1 No when disadvantaged (lighter Torrent) |
| `sand-rush` | Sand Rush | rock | `flat-yes` (existing) | 1 | +1 Yes, always |
| `cursed-body` | Cursed Body | ghost | `flat-no` (existing) | -1 | -1 No, always |

**Design notes:**
- `versatile` / `pure-power` are a mutually-exclusive pair — exactly one can ever fire per member,
  so they read as "your team-building bias" rather than a stackable buff.
- `sheer-force` / `scale-with-advantage` and `comeback` / `scale-with-disadvantage` mirror each
  other on the advantage axis; both cap at `value` (3), and both are gated on `opponentTypes.length`
  (same spurious-`delta` guard as `neutral-bonus`).
- `sheer-force` fires only when already advantaged and `comeback` only when disadvantaged, so like
  `justified`/`neutral-bonus` they never overlap with each other or with `offense-if-positive`.

**User: confirm these 7, edit, or swap any out.** (I flagged in chat that `sheer-force` is the
one most worth watching in playtest — it rewards snowballing.)

---

## Phase 1 — Data model & ability engine (no UI) ✅ DONE

**Goal:** abilities are keyed by a stable id and read from `PokemonItem.ability`, not species.

**Status:** Complete. 30-ability roster (`abilitiesById`) + `AbilityId` + 9 new effect types in
`abilities-data.ts`; `PokemonItem.ability?: AbilityId`; `AbilityService.getAbilityById` /
`getMemberAbility` + all 9 new switch-cases; battle/faint call sites read `getMemberAbility`;
`activeAbilityNames` now yields i18n keys, translated in `matchup-strip`; `abilities.<id>.name/.description`
added to all 6 locales (en real, others English placeholders); specs rewritten. Full suite: 731 green.

1. `abilities-data.ts`:
   - Add `export type AbilityId = 'blaze' | 'torrent' | ... ` (all 30 ids from §4a + §4b + §4c).
   - Add `id: AbilityId` to `AbilityDefinition`; change `name` to an i18n key string
     (`abilities.<id>.name`); add `descriptionKey: string` (`abilities.<id>.description`).
   - Extend `AbilityEffectType` with the 9 new members: `'double-edged' | 'defensive-synergy' |
     'punish-disadvantage' | 'low-team-offense' | 'neutral-bonus' | 'dual-type-offense' |
     'mono-type-offense' | 'scale-with-advantage' | 'scale-with-disadvantage'`.
   - Replace `abilitiesData: Record<number, AbilityDefinition>` with
     `abilitiesById: Record<AbilityId, AbilityDefinition>` containing all 30 §4a+§4b+§4c rows.
   - Delete the species (pokemonId) table.
2. `pokemon-item.ts`: add `/** New Experience only: player-assigned ability id, or undefined. */
   ability?: AbilityId;`.
3. `ability.service.ts`:
   - Replace `getAbility(pokemonId)` with `getAbilityById(id: AbilityId | undefined):
     AbilityDefinition | undefined` and `getMemberAbility(member: PokemonItem):
     AbilityDefinition | undefined` (returns `getAbilityById(member.ability)`).
   - In `applyTeamAbilities`, replace `getAbility(member.pokemonId)` with
     `getMemberAbility(member)`. Add these 5 cases to the effect `switch` (the existing 8 are
     unchanged):
     ```ts
     case 'double-edged':          // +value Yes and +value No (variance, net-neutral)
       yesBonus += ability.value;
       noBonus  += ability.value;
       break;
     case 'defensive-synergy': {   // -value No per team member sharing a type
       const synergyCount = team.filter(other => this.sharesType(other, member)).length;
       noBonus += -ability.value * synergyCount;
       break;
     }
     case 'punish-disadvantage':   // +value Yes when this member is disadvantaged
       if (opponentTypes.length && delta < 0) yesBonus += ability.value;
       break;
     case 'low-team-offense':      // +value Yes while team has <= 2 members
       if (team.length <= 2) yesBonus += ability.value;
       break;
     case 'neutral-bonus':         // +value Yes on an exactly-neutral matchup
       if (opponentTypes.length && delta === 0) yesBonus += ability.value;
       break;
     case 'dual-type-offense':     // +value Yes if this member is dual-typed
       if (member.type2) yesBonus += ability.value;
       break;
     case 'mono-type-offense':     // +value Yes if this member is single-typed
       if (!member.type2) yesBonus += ability.value;
       break;
     case 'scale-with-advantage':  // +Yes equal to the advantage, capped at value
       if (opponentTypes.length && delta > 0) yesBonus += Math.min(delta, ability.value);
       break;
     case 'scale-with-disadvantage': // +Yes equal to |disadvantage|, capped at value
       if (opponentTypes.length && delta < 0) yesBonus += Math.min(-delta, ability.value);
       break;
     ```
     Note the `opponentTypes.length` guards on `punish-disadvantage` / `neutral-bonus`: `delta` is
     forced to 0 when there are no opponent types (line 45-47), so without the guard `neutral-bonus`
     would fire spuriously.
4. `base-battle-roulette.component.ts`:
   - line ~146: `activeAbilityNames = trainerTeam.map(m => abilityService.getMemberAbility(m)?.name)
     .filter(Boolean)` — now yields **i18n keys**. Update `<app-matchup-strip>` template so the
     badge translates them (`matchup-strip.component.html:41`: wrap the interpolation in
     `| translate`). Confirm all four battle templates pass keys, not literals.
   - line ~148: unchanged (`applyTeamAbilities(this.trainerTeam, types)`).
5. `rival-battle-roulette.component.ts:115`: `abilityService.getMemberAbility(lead)?.effect ===
   'faint-immune-lead'`.
6. i18n: add an `abilities` block to `en.json` with `<id>.name` + `<id>.description` for all 30
   (§4a + §4b + §4c; write one-line descriptions from the "Behavior" column). Stub the same keys in
   de/es/fr/it/pt (English fallback is fine to start; keep keys present).
7. Specs: update `ability.service.spec.ts`, `base-battle-roulette.component.spec.ts`,
   `rival-battle-roulette.component.spec.ts` to set `member.ability` instead of relying on species
   ids. Grep for `getAbility(` and `pokemonId: 6`/`143`/etc. in specs.

**Acceptance:**
- `npm run test:local` green.
- A team member with `ability: 'blaze'` and a type advantage gets +2 Yes; with no `ability`,
  zero contribution.
- No Pokémon has an ability unless `ability` is set.
- Rival lead with `ability: 'sturdy'` survives one faint.
- Each new mechanic has a unit test: `reckless` adds +1 Yes/+1 No; `defensive-synergy` scales No
  by shared-type count; `punish-disadvantage` fires only on delta<0; `low-team-offense` only at
  team.length<=2; `neutral-bonus` only on delta==0 with opponent types present;
  `dual-type-offense`/`mono-type-offense` fire on the member's typing; `scale-with-advantage` and
  `scale-with-disadvantage` add the (dis)advantage magnitude capped at `value` and don't fire when
  `opponentTypes` is empty.

## Phase 2 — Capsule items + acquisition wheel ✅ DONE

**Goal:** loot a specific ability capsule from the adventure wheel into the bag.

**Status:** Complete. `ItemItem.abilityId?`; `AbilityCapsuleName` (template-literal over `AbilityId`)
+ `abilityCapsulesData` (30, derived from `abilitiesById`, baked-in shared capsule sprite,
type-colored slices); `ItemName` extended; `ItemsService.getAbilityCapsule` / `getAbilityCapsules`
(kept OUT of `getRegularItems`); new `'find-ability-capsule'` GameState; new
`FindAbilityCapsuleRouletteComponent`; adventure `rewardPool` gains a New-Experience-only
`findAbilityCapsule` candidate (weight 2) + handler + `findAbilityCapsuleEvent`; container routes it
to the wheel and bags the pick via `receiveItem`; i18n added to all 6 locales. Full suite: 736 green;
prod build clean. NOTE for Phase 3: a capsule in the bag is inert in `items.component` (no `useItem`
branch matches `capsule-*`), so it can't be "used" from there — assignment happens in the PC.

1. `ItemItem` (`item-item.ts`): add `/** Ability capsules only. */ abilityId?: AbilityId;`.
2. New `ability-capsule-names.ts`: `export type AbilityCapsuleName = 'capsule-blaze' | ...` (one
   per ability id — all 30). New `ability-capsules-data.ts`:
   `export const abilityCapsulesData: Record<AbilityCapsuleName, ItemItem>` — each
   `{ text: 'abilities.<id>.name', name: 'capsule-<id>', sprite: '', fillStyle: <type color>,
   weight: 1, description: 'abilities.<id>.description', abilityId: '<id>' }`. Use the same
   type→color source the app already uses for type UI if one exists; otherwise a per-type hex is
   fine. Flat weights (all 1) = equal drop chance.
3. `item-names.ts`: `ItemName = RegularItemName | MegaStoneItemName | AbilityCapsuleName`.
4. `items.service.ts`: fold `abilityCapsulesData` into `itemsData` (so `getItem` resolves them);
   add `getAbilityCapsules(): ItemItem[]` = `Object.values(abilityCapsulesData)`. Do NOT add them
   to `getRegularItems()` (keeps them off the regular item wheel).
5. `game-state.ts`: add `'find-ability-capsule'` to the GameState union.
6. New component `find-ability-capsule-roulette` (clone `find-item-roulette`): spins over
   `itemService.getAbilityCapsules()`, resolves sprite, shows explainer modal, emits
   `capsuleSelectedEvent: EventEmitter<ItemItem>`. Register it in `roulette-container`'s template
   under `@if currentState === 'find-ability-capsule'`.
7. `main-adventure-roulette.component.ts`: add a `findAbilityCapsule` candidate to the New
   Experience `rewardPool` (weight comparable to `findItem`, e.g. 2 — tune later); add its
   `actionHandlers` entry emitting a new `findAbilityCapsuleEvent`. New Experience only.
8. `roulette-container.component.ts`: handle `findAbilityCapsuleEvent` →
   `setNextState('find-ability-capsule')`; on `capsuleSelectedEvent` →
   `trainerService.addToItems(capsule)` then advance state as `findItem` does.
9. i18n: add `actions.findAbilityCapsule` (adventure slice label) + any modal strings. Capsule
   name/description reuse the `abilities.<id>.*` keys.
10. Specs: cover `getAbilityCapsules()`, the new roulette emit, and the container routing. Update
    `run-persistence.service.spec.ts` only if it asserts an exhaustive item set.

**Acceptance:**
- In New Experience, the adventure reward wheel can land on "Find Ability Capsule", opening a wheel
  that awards one capsule to the bag.
- The capsule persists across reload (it's a plain `ItemItem` in `trainerItems`).
- Regular item wheel is unchanged (no capsule slices).

## Phase 3 — Assignment UI in storage-pc ✅ DONE

**Goal:** assign an owned capsule to a Pokémon from the PC/team detail; consumes the capsule,
overwrites any existing ability.

**Status:** Complete. `storage-pc` gains `isNewExperienceMode`, `getMemberAbilityName`,
`ownedCapsules`, `openAbilityPicker`, `assignAbility` (overwrites + consumes via `removeItem` +
`commitTeamAndStorage`), `closeAbilityPicker`. Both team and stored cards show a translated
ability badge + an "Ability" assign button (assign hidden for fainted mons and when no capsules);
a stacked picker modal lists owned capsules with name + description. All ability UI gated behind
`isNewExperienceMode`. Styling mirrors the fainted-badge treatment and lives on the PC modal's
fixed light surface (`#dfe6e9`), so it's legible in all three app themes **by construction** — the
modal content never adopts the page theme. i18n (`assignAbility`, `assignAbilityTitle`,
`currentAbility`, `cancel`) added to all 6 locales. Full suite: 741 green; prod build clean.

**Note:** the ability UI renders only inside the always-light PC/picker modals, so there are no
`body.theme-x`-conditional rules and thus no global-`styles.css` changes were needed (the
encapsulation gotcha doesn't apply here). A final manual click-through in all three themes is still
worth doing but the surface is theme-independent.

1. `storage-pc.component.ts`:
   - `getMemberAbilityName(p: PokemonItem): string | null` → `abilityService.getMemberAbility(p)?.name`
     (i18n key; translate in template).
   - `ownedCapsules(): ItemItem[]` → `trainerService.getItems().filter(i => i.abilityId)`.
   - `assignAbility(pokemon: PokemonItem, capsule: ItemItem)`: `pokemon.ability = capsule.abilityId!;
     trainerService.removeItem(capsule); commitTeamAndStorage(team, stored);`. Guard to
     `gameStateService.isNewExperienceMode`.
2. `storage-pc.component.html`: on each card (both grids), mirror the fainted-badge pattern —
   an `ability-badge` showing `getMemberAbilityName(pokemon) | translate` when present, and an
   "Assign" affordance that opens a small list of `ownedCapsules()` (each `capsule.text | translate`)
   → `assignAbility(pokemon, capsule)`. Show the assign control only when
   `isNewExperienceMode && ownedCapsules().length`. Overwrite is implicit (no confirm needed; note
   in §5 if you want a confirm).
3. Styling: `ability-badge` akin to `fainted-badge`. **Follow the UI / theming requirements
   above** — non-theme rules in `storage-pc.component.css`, but any `body.theme-x`-conditional
   rule MUST live in global `styles.css` (component-scoped theme selectors silently never match).
   Verify legibility/positioning in all three themes.
4. i18n: `storagePc.assignAbility`, `storagePc.noCapsules`, `storagePc.abilityLabel`, etc.
5. Specs: `assignAbility` sets `ability`, removes the capsule, and the change survives a persist
   round-trip; re-assign overwrites.

**Acceptance:**
- Owning a "Capsule: Blaze" + assigning it to Pikachu → Pikachu shows a Blaze badge, the capsule
  leaves the bag, and after reload Pikachu still has Blaze.
- Assigning a second capsule overwrites the first.
- The next battle's matchup strip reflects the newly assigned ability.
- Badge, Assign control, and capsule picker are legible and well-positioned in all three themes
  (`theme-starters`, `theme-plain-dark`, `theme-plain-light`) — checked via the in-app theme
  selector — and drag-and-drop still works on a full team and in the PC grid.

## Phase 4 — README, docs, cleanup ✅ DONE

1. README "Abilities & the faint mechanic": rewrite for the assignable model (loot capsules →
   assign from PC → overwrite/consume; Sturdy is now an assignable faint-saver). Update the
   feature-list bullet (line ~15).
2. Add the fork feature to the "New features" changelog list (README convention).
3. Remove any stale backlog entries this supersedes; verify none of `docs/todo/backlog.md`'s open
   items are now done.
4. Verify Credits/Coffee attribution unaffected.

**Acceptance:** README matches shipped behavior; full suite green; manual smoke via `/run`.

**Status:** Complete. README feature bullet (~line 15) and the "Abilities & the faint mechanic"
section rewritten for the assignable/capsule model (roster of 30, loot → assign-from-PC →
overwrite/consume, Sturdy as an assignable faint-saver). No stale backlog entry (the sole open
item — in-game feedback — is unrelated); Credits/Coffee untouched.

---

## Notes / risks

- **Old saves** lose passive species abilities (field simply absent). No migration needed; call it
  out in the README changelog.
- **Matchup badge** now shows player-assigned abilities automatically via `activeAbilityNames` —
  no separate work beyond the i18n-key translation tweak in Phase 1.
- **Balance:** the roster reuses proven effect values; assignment lets players *stack* strong
  effects intentionally, which is a bigger swing than random species luck. Watch aggregate
  yes/no bonuses in playtesting; the `rawNoCount` floor at `baseNoCount`
  (`base-battle-roulette.component.ts:185-187`) still caps No-reduction.
- **Capsule as bag item:** capsules live in `trainerItems` alongside potions. If the item bag UI
  (`items.component.ts`) shouldn't let players "use" a capsule from there (assignment is PC-only),
  make its `useItem` branch a no-op / informational for `abilityId` items.
