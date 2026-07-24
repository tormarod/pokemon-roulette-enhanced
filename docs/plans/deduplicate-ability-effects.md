# Deduplicate ability effects (give clones distinct mechanics)

Status: **Phases 1–2 done; Phases 3–4 pending**

- [x] Phase 1 — Core mechanics (data + service + plumbing). Builds/type-checks
      clean; only the 3 stale specs + 1 battle-odds case fail (rewritten in Phase 2).
- [x] Phase 2 — Tests. Rewrote the 3 stale ability specs (repurposed to the new
      canonical holders: intimidate/swarm/multiscale) + swapped the battle-odds
      torrent case to multiscale; added one `it` per new mechanic and a
      battle-odds context-threading case. Full suite green (957).
- [ ] Phase 3 — i18n descriptions
- [ ] Phase 4 — Release plumbing & cleanup

## Problem

Assignable abilities map to an `(effect, value)` pair in
`src/app/services/ability-service/abilities-data.ts`. **15 of the 30 abilities
share their `(effect, value)` with another ability**, so they are mechanically
identical and their i18n descriptions are word-for-word duplicates. Collision
groups today:

| effect / value | abilities |
|---|---|
| `flat-no` / −2 | intimidate, thick-fat, clear-body, keen-eye, snow-cloak, cursed-body |
| `flat-yes` / 2 | static, poison-point, sand-rush |
| `offense-if-positive` / 3 | blaze, overgrow |
| `offense-if-positive` / 2 | swarm, rough-skin |
| `soak-if-negative` / −3 | torrent, multiscale |

Chosen direction (user-approved): **Option B — give each colliding ability a
genuinely distinct mechanic.** Keep one canonical holder per group; redesign the
other 10.

Secondary correctness bug found while investigating: every existing flat/offense
description understates its true ticket magnitude by exactly 1 (e.g. Guts has
`value: 3` but reads "+2 Yes"; Static has `value: 2` but reads "+1 Yes"). A flat
effect adds exactly `value` tickets — the "+1 base ticket" is separate — so the
text is stale, not a different unit. Fix in this same pass (en scope, see Phase 3).

## Current system (so an execution session needn't re-research)

- **`abilities-data.ts`** — declares `AbilityEffectType` (17 effect strings),
  `AbilityId` (30 ids), `AbilityDefinition { id, name, descriptionKey, type,
  effect, value }`, the `ability(id, type, effect, value)` factory, and the
  `abilitiesById: Record<AbilityId, AbilityDefinition>` table. `type` is
  display/grouping only — **not** read by the numeric effect. `value` semantics
  are per-effect (see the doc-comment on `AbilityDefinition.value`).
- **`ability.service.ts`** — `applyTeamAbilities(team, opponentTypes)` folds every
  member's assigned-ability effect into `{ yesBonus, noBonus, extraRetry }` via a
  `switch (ability.effect)`. Per member it computes
  `delta = opponentTypes.length ? typeMatchupService.getMemberSignedDelta(member, opponentTypes) : 0`.
  Helpers: `memberTypes`, `sharesType`. `noBonus` is signed — negative values
  *reduce* the No count. Only production caller is battle-odds (below).
- **`battle-odds.service.ts`** — `computeOdds(input: BattleOddsInput)` is the single
  source of odds arithmetic. At line ~84 it calls `applyTeamAbilities(team,
  opponentTypes)` and folds `abilityYes`/`abilityNo`/`extraRetry` in. Relevant
  locals already present in scope:
  - `input.currentRound` (integer, cumulative leaders defeated),
  - `input.badOmen ?? 0`,
  - `roundThreat = Math.ceil(currentRound * ROUND_THREAT_MULT)` (currently computed
    *after* the ability call at line ~96 — must be moved above it, see Phase 1),
  - `baseNoCount` floor: `noTickets = Math.max(baseNoCount, rawNo)`, so a negative
    `abilityNo` can never drive No below `baseNoCount` — new No-reducing mechanics
    are automatically floor-safe.
- **`ability.service.spec.ts`** — calls `service.applyTeamAbilities([...], [...])`
  with **two** args and a `withDelta(n)` helper that stubs
  `getMemberSignedDelta` to a constant. The new context param **must be optional**
  so these existing calls keep compiling/passing.
- **i18n** — `src/assets/i18n/{en,de,es,fr,it,pt}.json`, each with an `abilities`
  object of 30 `{ name, description }` entries keyed by `AbilityId`. `descriptionKey`
  = `abilities.<id>.description`.

## Design: canonical vs. redesigned

**Keep as-is (canonical holder of its effect):** Intimidate (`flat-no` −2),
Static (`flat-yes` 2), Blaze (`offense-if-positive` 3), Swarm
(`offense-if-positive` 2), Multiscale (`soak-if-negative` −3). Multiscale keeps
the defensive soak — Torrent moves off it. (`marvel-scale` stays `soak-if-negative`
−2: different magnitude from Multiscale, not a hard collision.)

**Redesign — 10 new `AbilityEffectType`s, one per ability:**

| Ability | new effect id | value | Behavior (in `applyTeamAbilities`) |
|---|---|---:|---|
| Torrent | `rally-outmatched` | 1 | `yesBonus += value * (# team members with delta < 0)` |
| Keen Eye | `spot-weakness` | 1 | `yesBonus += value * (# team members with delta > 0)` |
| Overgrow | `grow-with-round` | 3 | `yesBonus += Math.min(ctx.round, value)` |
| Rough Skin | `blunt-threat` | 2 | `noBonus += -Math.min(ctx.roundThreat, value)` |
| Poison Point | `venom-vs-dual` | 2 | `if (opponentTypes.length === 2) yesBonus += value` |
| Cursed Body | `curse-vs-dual` | −2 | `if (opponentTypes.length === 2) noBonus += value` |
| Clear Body | `focus-vs-mono` | −2 | `if (opponentTypes.length === 1) noBonus += value` |
| Sand Rush | `reckless-rush` | 2 | `yesBonus += value; noBonus += Math.round(value / 2)` |
| Snow Cloak | `snow-refuge` | −2 | `if (team.length <= 2) noBonus += value` |
| Thick Fat | `cushion-omen` | 2 | `noBonus += -Math.min(ctx.badOmen, value)` |

Notes:
- All values sit in the current ±2–3 ticket band. `rally-outmatched` /
  `spot-weakness` scale with team makeup (max realistically +2/+3), comparable to
  Synchronize's `team-synergy` scaling.
- `value` stays **negative** for the No-reducing effects (`curse-vs-dual`,
  `focus-vs-mono`, `snow-refuge`) so `noBonus += value` subtracts, matching the
  existing `flat-no` convention. `blunt-threat` and `cushion-omen` store a
  **positive** cap and negate inside the case (they subtract "up to N of an
  existing No source", so the cap must be positive to `Math.min` against it).
- `type` field is unchanged for every ability (display only).

## Phase 1 — Core mechanics (data + service + plumbing)

**1a. `abilities-data.ts`**
- Add the 10 new strings to the `AbilityEffectType` union:
  `rally-outmatched | spot-weakness | grow-with-round | blunt-threat |
  venom-vs-dual | curse-vs-dual | focus-vs-mono | reckless-rush | snow-refuge |
  cushion-omen`.
- Repoint the 10 rows in `abilitiesById` to their new `(effect, value)` per the
  table above. Concretely, the changed lines:
  - `'torrent'`: `ability('torrent', 'water', 'rally-outmatched', 1)`
  - `'keen-eye'`: `ability('keen-eye', 'flying', 'spot-weakness', 1)`
  - `'overgrow'`: `ability('overgrow', 'grass', 'grow-with-round', 3)`
  - `'rough-skin'`: `ability('rough-skin', 'ground', 'blunt-threat', 2)`
  - `'poison-point'`: `ability('poison-point', 'poison', 'venom-vs-dual', 2)`
  - `'cursed-body'`: `ability('cursed-body', 'ghost', 'curse-vs-dual', -2)`
  - `'clear-body'`: `ability('clear-body', 'steel', 'focus-vs-mono', -2)`
  - `'sand-rush'`: `ability('sand-rush', 'rock', 'reckless-rush', 2)`
  - `'snow-cloak'`: `ability('snow-cloak', 'ice', 'snow-refuge', -2)`
  - `'thick-fat'`: `ability('thick-fat', 'normal', 'cushion-omen', 2)`

**1b. `ability.service.ts`**
- Add an exported context interface and make it an optional 3rd param with a
  zero default so existing 2-arg callers/tests are unaffected:
  ```ts
  export interface AbilityContext { round: number; roundThreat: number; badOmen: number; }
  ...
  applyTeamAbilities(
    team: PokemonItem[],
    opponentTypes: PokemonType[],
    ctx: AbilityContext = { round: 0, roundThreat: 0, badOmen: 0 }
  ): { yesBonus: number; noBonus: number; extraRetry: boolean } {
  ```
- Before the `for` loop, precompute per-member deltas once and derive the two
  team counts (reuse for both the per-member `delta` and the team-count mechanics,
  so `getMemberSignedDelta` is still called once per member):
  ```ts
  const memberDeltas = team.map(m =>
    opponentTypes.length ? this.typeMatchupService.getMemberSignedDelta(m, opponentTypes) : 0);
  const advantagedCount = memberDeltas.filter(d => d > 0).length;
  const disadvantagedCount = memberDeltas.filter(d => d < 0).length;
  ```
  Then inside the loop use `const delta = memberDeltas[i];` (switch the loop to an
  index loop, or `team.forEach((member, i) => …)` — keep `extraRetry` etc. working).
- Add 10 `case`s to the `switch`:
  ```ts
  case 'rally-outmatched': yesBonus += ability.value * disadvantagedCount; break;
  case 'spot-weakness':    yesBonus += ability.value * advantagedCount;    break;
  case 'grow-with-round':  yesBonus += Math.min(ctx.round, ability.value);  break;
  case 'blunt-threat':     noBonus  += -Math.min(ctx.roundThreat, ability.value); break;
  case 'venom-vs-dual':    if (opponentTypes.length === 2) yesBonus += ability.value; break;
  case 'curse-vs-dual':    if (opponentTypes.length === 2) noBonus  += ability.value; break;
  case 'focus-vs-mono':    if (opponentTypes.length === 1) noBonus  += ability.value; break;
  case 'reckless-rush':    yesBonus += ability.value; noBonus += Math.round(ability.value / 2); break;
  case 'snow-refuge':      if (team.length <= 2) noBonus += ability.value; break;
  case 'cushion-omen':     noBonus  += -Math.min(ctx.badOmen, ability.value); break;
  ```

**1c. `battle-odds.service.ts`**
- Move the `const roundThreat = Math.ceil(currentRound * ROUND_THREAT_MULT);`
  computation **above** the `applyTeamAbilities` call (it's currently below it).
- Pass the context:
  ```ts
  const a = this.abilityService.applyTeamAbilities(team, opponentTypes,
    { round: currentRound, roundThreat, badOmen: input.badOmen ?? 0 });
  ```
- Leave the rest of the No/Yes assembly unchanged (`rawNo` already includes
  `abilityNo`; the `Math.max(baseNoCount, rawNo)` floor still protects it).

**Acceptance (Phase 1):** `npm run build` clean; `AbilityEffectType` switch is
exhaustive (no missing-case). No behavior change for the 20 untouched abilities.

## Phase 2 — Tests

**`ability.service.spec.ts`** — the `withDelta` stub returns one constant for all
members, so team-count mechanics count the whole team. Add one `it` per new effect:
- `rally-outmatched` (torrent): `withDelta(-1)` on a 2-member team →
  `yesBonus: 2` (1 × 2 disadvantaged); `withDelta(1)` → `yesBonus: 0`.
- `spot-weakness` (keen-eye): `withDelta(1)` on a 2-member team → `yesBonus: 2`;
  `withDelta(-1)` → 0.
- `grow-with-round` (overgrow): pass ctx `{round: 2, roundThreat: 0, badOmen: 0}`
  → `yesBonus: 2`; ctx `{round: 9,…}` → `yesBonus: 3` (capped at value 3).
- `blunt-threat` (rough-skin): ctx `{roundThreat: 1,…}` → `noBonus: -1`; ctx
  `{roundThreat: 5,…}` → `noBonus: -2` (capped); ctx `{roundThreat: 0,…}` → 0.
- `venom-vs-dual` (poison-point): `['fire','flying']` → `yesBonus: 2`; `['fire']` → 0.
- `curse-vs-dual` (cursed-body): `['fire','flying']` → `noBonus: -2`; `['fire']` → 0.
- `focus-vs-mono` (clear-body): `['fire']` → `noBonus: -2`; `['fire','flying']` → 0.
- `reckless-rush` (sand-rush): `yesBonus: 2, noBonus: 1`.
- `snow-refuge` (snow-cloak): 2-member team → `noBonus: -2`; 3-member team → 0.
- `cushion-omen` (thick-fat): ctx `{badOmen: 3,…}` → `noBonus: -2` (capped at value);
  ctx `{badOmen: 1,…}` → `noBonus: -1`; ctx `{badOmen: 0,…}` → 0.
- **Delete/replace** the old assertions that no longer hold: `thick-fat` ("flat −2
  No regardless of delta"), `rough-skin` ("+2 Yes if delta positive"), `torrent`
  ("−3 No if delta negative"). Rewrite them to the new behavior above.

**`battle-odds.service.spec.ts`** — add/adjust a case proving context reaches the
service through `computeOdds`: e.g. a `blunt-threat` (rough-skin) member at a
high `currentRound` reduces `no.ability`, and a `cushion-omen` (thick-fat) member
with `badOmen > 0` reduces `no.ability` by up to 2. Check existing ability cases
in this spec still pass (grep for `thick-fat`/`torrent`/`rough-skin` there first).

**Acceptance (Phase 2):** `npm run test:local` green.

## Phase 3 — i18n descriptions

**en.json (source of truth) — rewrite all 10 redesigned descriptions accurately,
and correct the off-by-one on the untouched flat/offense ones.** Proposed English:

Redesigned:
- torrent: `"Rallying tide: +1 Yes for each teammate at a type disadvantage."`
- keen-eye: `"Keen eyes: +1 Yes for each teammate at a type advantage."`
- overgrow: `"Grows stronger each round — more Yes the later in the run (up to +3)."`
- rough-skin: `"Blunts the round's threat, removing up to 2 No."`
- poison-point: `"+2 Yes against a dual-typed opponent."`
- cursed-body: `"−2 No against a dual-typed opponent."`
- clear-body: `"−2 No against a single-typed opponent."`
- sand-rush: `"Reckless charge: +2 Yes but also +1 No."`
- snow-cloak: `"−2 No while your team has 2 or fewer Pokémon."`
- thick-fat: `"Cushions bad-omen No by up to 2."`

Off-by-one corrections (untouched mechanics — bump the shown magnitude to match
`value`): guts `+3 Yes`, static `+2 Yes`, poison→(redesigned), intimidate `−2 No`,
blaze `+3 Yes when advantage`, overgrow→(redesigned), swarm `+2 Yes when advantage`,
multiscale `−3 No when disadvantaged`, marvel-scale `−2 No when disadvantaged`,
and the remaining flat/offense/soak entries by the same +1 rule. (Levitate,
Synchronize, Sturdy, Serene Grace, and the §4b/§4c scale/synergy descriptions
are already accurate — leave them.)

**Other 5 locales (de/es/fr/it/pt):** for the 10 **redesigned** abilities, drop in
the English text as a placeholder (per repo convention for untranslated new
strings). For the off-by-one numeral fix on untouched abilities, **do not** hand-
edit 5 translated files here — capture it as a backlog item (Phase 4) so numerals
+ the 10 placeholders get a proper translation pass together.

**Acceptance (Phase 3):** every `AbilityId` still has `name` + `description` in all
6 locales; app builds; spot-check the abilities panel in a dark theme and
plain-light (readable, no leftover duplicate text).

## Phase 4 — Release plumbing & cleanup

- **`package.json`**: `3.15.1` → `3.16.0` (MINOR — reworks what 10 mechanics *do*).
- **`release-notes.ts`**: add a newest-first entry `version: '3.16.0'`, date
  `2026-07-24`, with note keys `whatsNew.v3_16_0.0` (and `.1` if splitting the
  headline from the "descriptions corrected" note).
- **All 6 locale files**: add `whatsNew.v3_16_0` object with those keys — en real
  (e.g. `"⚔️ Abilities overhaul: ten abilities that used to be mechanical
  duplicates now have their own distinct effects (Torrent rallies when you're
  outmatched, Overgrow grows each round, Thick Fat cushions bad luck, and more)."`),
  others English placeholder.
- **`README.md`**: add a bullet to "New features added on top of the original".
- **`docs/todo/backlog.md`**: add one entry — "Sync de/es/fr/it/pt ability
  descriptions with en: translate the 10 redesigned abilities and apply the
  off-by-one numeral correction to the untouched ones." Re-verify the two existing
  ability backlog entries (`team-synergy…`, `Ability capsules drop fully random`)
  are still open (they are — leave them).
- Move this plan file to `docs/plans/done/` once all phases ship.

**Acceptance (Phase 4):** `npm run build` + `npm run test:local` green; What's New
modal shows the 3.16.0 entry on a fresh `localStorage`.

## Full acceptance checklist

1. No two abilities share an `(effect, value)` pair except the intentional
   `soak-if-negative` pair (multiscale −3 vs marvel-scale −2, distinct values).
2. Each of the 10 redesigned abilities produces its documented `{yesBonus,
   noBonus, extraRetry}` for the inputs in Phase 2.
3. `computeOdds` threads round/roundThreat/badOmen into abilities (Phase 2
   battle-odds cases pass).
4. All 20 untouched abilities behave exactly as before.
5. `npm run build` and `npm run test:local` both clean.
