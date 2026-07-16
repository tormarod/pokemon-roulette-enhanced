# Plan: Type matchup — cancel phantom advantage from offensive resistance

Status: **Ready to implement. All decisions baked in — no open questions.**
Owner: tormarod
Last updated: 2026-07-16
File to edit: `src/app/services/type-matchup-service/type-matchup.service.ts`
Tests to edit: `src/app/services/type-matchup-service/type-matchup.service.spec.ts`

## Bug

`getMemberTier` returns an advantage tier for a member that only *resists* the
opponent, even when its own attacks are equally resisted. Example: **Poison vs
Poison returns `resistant` (+1); it must return `neutral` (0)** — you resist their
Poison, but your Poison is resisted by them, so it's a wash. This shows in both
the wheel odds and the tooltip strip.

## Root cause (verified)

In `getMemberTier` (currently ~L117–132), the offense read is
super-effective-only:
`isOffenseStrong = memberTypes.some(mt => opponentTypes.some(ot => this.isStrongAgainst(mt, ot)))`.
There is no check for the opponent *resisting or being immune to* the member's
attacks, so a defensive resist (`resistant`/`hard-resistant`) or defensive
immunity (`strong`) has nothing to offset it.

Data helpers already exist — offensive resistance/immunity are the same helpers
with swapped args: `this.resists(opponentType, memberType)` and
`this.isImmuneTo(opponentType, memberType)`. **No `type-matchups-data.ts` change.**

## The fix (single function edit)

Replace the body of `getMemberTier` with this. It adds one boolean,
`offensivelyWalled`, and uses it to downgrade the three defense-only advantage
tiers to `neutral`. Everything else is unchanged.

```ts
getMemberTier(member: PokemonItem, opponentTypes: PokemonType[]): 'strong' | 'neutral' | 'weak' | 'hard-countered' | 'resistant' | 'hard-resistant' {
  if (!opponentTypes.length) return 'neutral';

  const memberTypes = this.getMemberTypes(member);
  const isOffenseStrong = memberTypes.some(mt => opponentTypes.some(ot => this.isStrongAgainst(mt, ot)));
  const defenseTier = this.getDefenseTier(memberTypes, opponentTypes);

  // NEW: the member has no effective offense at all — not super-effective against
  // anything, and every one of its attacking types is resisted or nullified by
  // every opponent type. Best-case read: if ANY member type can hit ANY opponent
  // type neutrally-or-better, it is NOT walled.
  const offensivelyWalled =
    !isOffenseStrong &&
    memberTypes.length > 0 &&
    opponentTypes.every(ot => memberTypes.every(mt => this.resists(ot, mt) || this.isImmuneTo(ot, mt)));

  if (defenseTier === 'immune') return offensivelyWalled ? 'neutral' : 'strong';
  if (isOffenseStrong && (defenseTier === 'weak' || defenseTier === 'doubleWeak')) return 'neutral';
  if (isOffenseStrong) return 'strong';
  if (defenseTier === 'doubleWeak') return 'hard-countered';
  if (defenseTier === 'weak') return 'weak';
  if (defenseTier === 'doubleResist') return offensivelyWalled ? 'neutral' : 'hard-resistant';
  if (defenseTier === 'resist') return offensivelyWalled ? 'neutral' : 'resistant';
  return 'neutral';
}
```

Nothing else changes. `calcTeamMatchupTotals` and `getMatchupTypes` already treat
`neutral` as "contributes to neither total / no icon", so a tier flipping to
`neutral` removes it from both the odds delta and the tooltip strip automatically.

### Decisions already made (do not re-open)

- **Scope = conservative.** Offensive resistance only *cancels phantom advantages*
  (immune/resist/doubleResist → neutral). It never creates new disadvantages, and
  never touches `weak`/`hard-countered`/SE-`strong`. This keeps the tuned
  advantage/disadvantage curve intact.
- **`offensivelyWalled` requires EVERY member type resisted/nullified by EVERY
  opponent type** (best-case offense). If any attacking type lands neutrally, the
  member is not walled and keeps its defensive advantage.
- **`doubleResist` when walled → `neutral`** (full cancel; no partial tier).
- **Normal vs Ghost (immune both ways) → `neutral`** (can't hurt each other).

## Tests (add to `type-matchup.service.spec.ts`)

Use the existing `makeTestPokemon`/team helpers in that spec. Assert
`service.getMemberTier(makeTestPokemon({ type1, type2? }), opponentTypes)` equals
the expected tier:

| type1 | type2 | opponentTypes | expected | note |
|---|---|---|---|---|
| poison | — | ['poison'] | `neutral` | the bug (was `resistant`) |
| steel | — | ['steel'] | `neutral` | mirror (was `resistant`) |
| normal | — | ['ghost'] | `neutral` | immune both ways (was `strong`) |
| steel | — | ['steel','steel'] | `neutral` | doubleResist walled (was `hard-resistant`) |
| poison | steel | ['poison'] | `strong` | steel can poke + immune wall → NOT walled |
| water | — | ['fire'] | `strong` | SE + resist, unchanged |
| grass | — | ['fire'] | `weak` | unchanged |
| fire | — | ['water'] | `weak` | offensively resisted but defensively weak → stays `weak` |
| electric | — | ['ground'] | `weak` | offensively nullified but defensively weak → stays `weak` |
| grass | — | ['water'] | `strong` | SE vs water + resists water, unchanged |

Then run the full suite (`npm run test:local`) and fix any **existing** tier tests
that asserted the old phantom advantage for a mirror/immune-both-ways case —
those flips to `neutral` are intended, not regressions.

## Steps

1. Edit `getMemberTier` as above in `type-matchup.service.ts`.
2. Add the 10 test rows above to `type-matchup.service.spec.ts`.
3. Run `npm run test:local`; update any pre-existing tier assertions that the fix
   intentionally changes (mirror/immune-both-ways only).
4. Manually confirm in-app: a Poison team member vs an Electric... (any mirror,
   e.g. Poison vs a Poison-type leader) shows no advantage on the strip.
5. Update this status to done; delete the backlog pointer entry.
