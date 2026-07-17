# Plan: Type matchup — symmetric offense/defense scoring (replaces best-case/walled model)

Status: **Done.** Shipped: `type-matchup.service.ts` rewritten, spec rewritten (554/554
passing), all 4 battle-component specs updated, `npm run build` clean, manual Playwright
spot-check confirmed both the reported Grass/Fairy-vs-Grass case (now neutral, no strip
section) and a symmetric-penalty case (Ice/Flying vs Rock, -3 not old -4). README's "Battle
balancing" section rewritten. Follow-up playtest note added to `docs/todo/backlog.md`.

## Context

While reviewing the just-shipped matchup-strip display refactor, the user flagged that a
Grass/Fairy team vs. a Grass gym leader shows "Resists Grass +1" — and argued it should be
a net 0: their Grass half is resisted both ways (they hit us at 0.5×, we hit them at 0.5×,
cancels), and their Fairy half has no relationship to Grass at all (contributes nothing).

Investigating confirmed the current model (`getMemberTier`/`getDefenseTier` in
`type-matchup.service.ts`) is asymmetric by design: **defense** is worst-case across both of
a member's types (a hit lands regardless of what we'd "want"), but **offense** is best-case —
it assumes the player always picks their single most favorable type to attack with, and only
cancels a resist-based advantage if *every* member type is walled. That's why Grass/Fairy
gets credit (Fairy is "the move you'd pick instead of resisted Grass") while pure Grass does
not (no alternative — cancels to neutral).

The user's ask: since the game has no move/ability system yet — only two static types per
Pokémon — stop cherry-picking a "best" offensive type. Score offense the same symmetric way
defense already is: every type a Pokémon has is always "active," on both sides.

**This is not a narrow fix.** A data check
(`typeMatchups` in `type-matchup-service/type-matchups-data.ts`) found that **30 of the
game's 51 super-effective relationships (59%) are "mutual"** — the attacking type is *also*
resisted-by/immune-to on the retaliation side (e.g. Fire beats Grass AND resists Grass's
counter-hit; Water beats Fire AND resists Fire's counter-hit; Ground beats Electric AND is
immune to it). Under symmetric scoring, all of these become *stronger* advantages/disadvantages
than they are today, not just the Grass/Fairy case. The user confirmed they want the full
rework (not a narrower patch), understanding it's a real difficulty rebalance across every
battle type, to be followed by playtesting.

**Scope:** this only touches `type-matchup.service.ts` and its spec. The public method
signatures (`calcTeamMatchupTotals`, `getMatchupTypes`) keep their existing shape, so
`base-battle-roulette.component.ts`, the 4 battle components, `MatchupStripComponent`, its
templates, and i18n **do not change** — confirmed via `grep` that only those two files
(service + spec) reference `getMemberTier`/`getTierDeltaMagnitude`/`calcTeamMatchupTotals`/
`getMatchupTypes` anywhere in `src/`.

## The new model

Replace the six-tier enum (`strong`/`neutral`/`weak`/`hard-countered`/`resistant`/
`hard-resistant`) and its `getDefenseTier`/`getMemberTier`/`getTierDeltaMagnitude` machinery
with a single **numeric net score**, computed the same way for every member type against
every opponent type — no "pick the best type" step anywhere.

### Per-type-pair contribution

For one of the member's types `mt` against one opponent type `ot`, using the existing
low-level helpers (`isStrongAgainst`, `isWeakAgainst`, `resists`, `isImmuneTo` — **unchanged**,
still on the service):

```ts
private offenseContribution(mt: PokemonType, ot: PokemonType): number {
  if (this.isStrongAgainst(mt, ot)) return 1;       // we hit them SE
  if (this.isImmuneTo(ot, mt)) return -2;            // they take 0 from our attack
  if (this.resists(ot, mt)) return -1;                // they take 0.5x from our attack
  return 0;
}

private defenseContribution(mt: PokemonType, ot: PokemonType): number {
  if (this.isImmuneTo(mt, ot)) return 2;              // we take 0 from their attack
  if (this.resists(mt, ot)) return 1;                 // we take 0.5x from their attack
  if (this.isWeakAgainst(mt, ot)) return -1;           // we take 2x from their attack
  return 0;
}
```

(`isImmuneTo(ot, mt)` reads "does opponent type `ot` take zero from our type `mt`" — same
function, arguments swapped from the defensive check. No new type-chart data needed.)

A pair's total contribution is `offenseContribution(mt, ot) + defenseContribution(mt, ot)`,
range `[-3, +3]`.

**Same-type pairs (`mt === ot`) always net to exactly 0.** `offenseContribution(mt, mt)` and
`defenseContribution(mt, mt)` both read the *same* self-relation off the type chart (whether
type X resists/is-immune-to/is-strong-against itself) — offense scores it negative
(`-1`/`-2`, "they resist our own-type attack"), defense scores the identical fact positive
(`+1`/`+2`, "we resist their own-type attack"). No type in `typeMatchups` is `strongAgainst`
or has a weakness to itself, so the `+1`/`-1` offense/defense branches never fire for a
self-pair either. The two always cancel. (This is exactly the arithmetic behind the
originally-reported Grass/Fairy case: Grass-vs-Grass contributes 0, Fairy-vs-Grass contributes
0, net 0.) Skip `mt === ot` pairs explicitly in both `getMemberNetScore` and the display
sub-scores below — a no-op for the numeric score, but it removes redundant/misleading
same-type icons from the display (see `getMatchupTypes` below).

### Net score (per member, vs the whole opponent type list)

```ts
private getMemberNetScore(member: PokemonItem, opponentTypes: PokemonType[]): number {
  const memberTypes = this.getMemberTypes(member); // existing private helper, unchanged
  let total = 0;
  for (const mt of memberTypes) {
    for (const ot of opponentTypes) {
      if (mt === ot) continue; // always cancels to 0 — see note above
      total += this.offenseContribution(mt, ot) + this.defenseContribution(mt, ot);
    }
  }
  return total;
}
```

Summing over `opponentTypes` **with repetition** automatically preserves the existing
"repeated type is an intentional emphasis lever" behavior (e.g. Lance's `['dragon',
'dragon']`) with no special-casing — a nice side effect of dropping the old bucket-counting
logic.

### Delta magnitude

`getMemberDelta` is repurposed as the **per-net-score-point unit** (was `ceil(power/2)`,
becomes `ceil(power/4)` — the old "resistant" unit, now the base unit since a plain
mutual-advantage pair like Water/Fire scores `netScore = 2`, and `2 * ceil(power/4)`
reproduces today's old "strong" `ceil(power/2)` magnitude for even powers):

```ts
getMemberDelta(member: PokemonItem): number {
  return Math.ceil(member.power / 4);
}
```

```ts
private getMemberDeltaSigned(member: PokemonItem, opponentTypes: PokemonType[]): number {
  return this.getMemberNetScore(member, opponentTypes) * this.getMemberDelta(member);
}
```

Update `getMemberDelta`'s doc comment and its existing spec block (`is half the Pokémon's
power...` tests) to describe `ceil(power/4)` instead of `ceil(power/2)`, with the same
never-zero/no-cap/team-independence properties (all still hold — `ceil(power/4) >= 1` for
`power >= 1`).

### `calcTeamMatchupTotals` — same signature, new internals

```ts
calcTeamMatchupTotals(team: PokemonItem[], opponentTypes: PokemonType[]):
    { yesPower: number; noBonus: number; advantageDelta: number; disadvantageDelta: number } {
  let yesPower = 0, advantageDelta = 0, disadvantageDelta = 0;
  for (const member of team) {
    yesPower += member.power;
    const delta = this.getMemberDeltaSigned(member, opponentTypes);
    if (delta > 0) { yesPower += delta; advantageDelta += delta; }
    else if (delta < 0) { disadvantageDelta += -delta; }
  }
  return { yesPower, noBonus: disadvantageDelta, advantageDelta, disadvantageDelta };
}
```

Same "never lose green, only gain red" property as before — a bad matchup adds `noBonus`
tickets, it never subtracts from `yesPower`.

### `getMatchupTypes` — same signature, new internals

For each member, only classify its types if the member's overall net score is nonzero (a
`netScore === 0` member — like pure Grass vs Grass, or the Grass/Fairy case — contributes to
neither list, same as today's "neutral member is skipped" behavior):

```ts
getMatchupTypes(team: PokemonItem[], opponentTypes: PokemonType[]):
    { superEffectiveTypes: PokemonType[]; resistTypes: PokemonType[]; weakTypes: PokemonType[] } {
  const superEffectiveTypes: PokemonType[] = [], resistTypes: PokemonType[] = [], weakTypes: PokemonType[] = [];
  const seenSe = new Set<PokemonType>(), seenRes = new Set<PokemonType>(), seenWeak = new Set<PokemonType>();
  if (!team.length || !opponentTypes.length) return { superEffectiveTypes, resistTypes, weakTypes };

  for (const member of team) {
    const netScore = this.getMemberNetScore(member, opponentTypes);
    if (netScore === 0) continue;
    const memberTypes = this.getMemberTypes(member);

    for (const mt of memberTypes) {
      let off = 0, def = 0;
      for (const ot of opponentTypes) {
        if (mt === ot) continue; // exclude self-type pairs — always-0, and showing them reads as misleading (see note above)
        off += this.offenseContribution(mt, ot);
        def += this.defenseContribution(mt, ot);
      }
      if (netScore > 0) {
        if (off > 0 && !seenSe.has(mt)) { superEffectiveTypes.push(mt); seenSe.add(mt); }
        if (def > 0 && !seenRes.has(mt)) { resistTypes.push(mt); seenRes.add(mt); }
      } else {
        if ((off < 0 || def < 0) && !seenWeak.has(mt)) { weakTypes.push(mt); seenWeak.add(mt); }
      }
    }
  }

  return { superEffectiveTypes, resistTypes, weakTypes };
}
```

### Display answer: same-type interactions are never shown

To directly answer "do we show enemy-resists-grass -1 *and* friendly-resists-grass +1, or
cancel them" — **we cancel them, by construction, and don't show either.** A member's own
type is excluded from its own off/def sub-score whenever it matches an opponent type (the
`if (mt === ot) continue` skip above). The type still fully participates in the numeric
`netScore` (which is unaffected either way, since it's always a 0 contribution), it just
never generates a same-type icon. Only types with a genuine cross-type relationship to the
opponent (like Poison vs a Grass opponent) show up in the strip.

### Remove

`getDefenseTier` (private), `getMemberTier` (public — confirmed unused outside this
service+spec), `getTierDeltaMagnitude` (public — same). Their doc comments' rationale is
superseded by this design's Context section above.

## Verified anchor values (computed via a standalone script against the real
`typeMatchups` table — use these as authoritative expected values when rewriting the spec,
don't re-derive by hand)

| Scenario (power=4 unless noted) | netScore | delta | Old behavior |
|---|---|---|---|
| Water vs [Fire] | 2 | 2 | was `strong`, delta 2 — unchanged |
| Grass vs [Fire] | -2 | -2 | was `weak`, delta 2 — **now doubled**, both offense and defense penalized (Fire resists Grass's counter too) |
| Grass/Fairy vs [Grass] | 0 | 0 | was `resistant` +1 — **now neutral**, the reported case, strip renders nothing |
| Pure Grass vs [Grass] | 0 | 0 | was `neutral` — unchanged |
| Bug(5) vs [Grass, Fire] | 0 | 0 | was `neutral` (cancel) — unchanged (different internal reasoning, same result) |
| Flying vs [Ground] | 2 | 2 | was `strong` (immune wall) — unchanged |
| Flying vs [Ground, Rock] | 0 | 0 | was `strong` (immunity always dominated) — **now neutral**: Rock hits Flying hard and resists its counter, which now cancels the Ground immunity instead of being overridden by it |
| Dragon/Water vs [Ice] | 0 | 0 | was `neutral` (resist cancels weak) — unchanged |
| Poison vs [Poison] | 0 | 0 | was `neutral` (offensive-resistance case) — unchanged |
| Steel vs [Steel] | 0 | 0 | was `neutral` — unchanged |
| Steel vs [Steel, Steel] | 0 | 0 | was `neutral` (doubleResist walled) — unchanged |
| Poison/Steel vs [Poison] | 2 | 2 | was `strong` — unchanged |
| Dragon vs [Water] | 1 | 1 | was `resistant`, delta 1 — unchanged |
| Water/Ice vs [Ice] | 1 | 1 | was `hard-resistant`, delta 2 — **now smaller**: Ice-vs-Ice is mutually self-resisting (cancels), only Water's plain resist survives. Display: `resistTypes: ['water']` only — Ice is excluded as a same-type pair (see note above), not shown as `['water','ice']` |
| Dragon vs [Fire, Water] | 2 | 2 | was `hard-resistant`, delta 2 — unchanged |
| Dragon vs [Ice, Fire] | 0 | 0 | was `weak` (weak dominates resist), delta 1 — **now neutral**: Fire resists Dragon's counter too, which now offsets the Ice weakness |
| Grass vs [Fire, Fire] (emphasis) | -4 | -4 | was `hard-countered`, delta 4 — unchanged magnitude, same reasoning |
| Ice/Flying vs [Rock] | -3 | -3 | was `hard-countered`, delta 4 — close, slightly smaller |
| Grass/Poison(3) vs [Grass] | 2 | 2 | display case from the shipped plan — `superEffectiveTypes: ['poison']`, `resistTypes: ['poison']` only. Grass is excluded from `resistTypes` now: its own defensive resist (`+1`) is exactly offset by its own offensive resist (`-1`) against the identical opponent type, so showing "Resists: Grass" would credit a type that nets to zero on its own — poison is the only type actually doing anything here |
| Ground/Rock vs [Electric] | 3 | 3 | was `strong` (immune via ground), delta 2 — now slightly larger (offense bonus adds on top of the immunity) |

The two rows worth calling out to the user as genuinely new, not just bigger/smaller:
**Flying vs [Ground, Rock]** and **Dragon vs [Ice, Fire]** — cases where immunity/resist no
longer unconditionally "wins," because a separate bad matchup against another opponent type
can now cancel it. This is a direct, correct consequence of dropping the best-case/dominant-
immunity shortcuts, not a bug.

## Spec rewrite (`type-matchup.service.spec.ts`)

Most of the existing file tests the retired tier vocabulary directly (`getMemberTier`,
`getTierDeltaMagnitude` blocks) and must be replaced, not patched:

1. Update the `getMemberDelta` tests block: expected values become `ceil(power/4)` (1,1,1,1,2,2,2,2
   for power 1..8) instead of `ceil(power/2)`. Keep the never-zero / no-hardcoded-ceiling /
   team-independence tests, just retarget the numbers.
2. Delete the `getMemberTier` test block and the `getTierDeltaMagnitude` test block entirely
   (those methods no longer exist).
3. Rewrite the `calcTeamMatchupTotals` block using the anchor table above (recompute
   `yesPower`/`noBonus`/`advantageDelta`/`disadvantageDelta` from each scenario's `delta` and
   member `power`, same pattern as the existing tests — e.g. `yesPower = power + delta` when
   `delta > 0`).
4. Rewrite the `getMatchupTypes` block (already touched by the shipped display plan, so the
   shape stays `{superEffectiveTypes, resistTypes, weakTypes}`) using the anchor table's
   sub-score reasoning — e.g. Grass/Fairy vs Grass now returns `{[], [], []}` (netScore 0,
   skipped entirely) instead of `{[], ['grass'], []}`.
5. Keep the low-level helper tests (`isStrongAgainst`/`isWeakAgainst`) — unchanged, still used.

## Verification

1. `npm run test:local` — full suite green.
2. `npm run build` — production build clean (no leftover references to removed methods).
3. Manual/Playwright spot-check (same technique used earlier this session — seed
   `localStorage['pokemon-roulette-run']` with a `gym-battle` state and a synthetic team, per
   `RunPersistenceService`'s `SavedRun` shape):
   - Grass/Fairy team vs Erika (grass, gen 1 round 3): **no matchup strip section renders**
     (both deltas are 0 — confirms the reported case is fixed).
   - Pure-Grass team vs a Fire-typed leader: confirm the red "Weak" delta is **larger** than
     before this change (was 2 at power 4, now also 2 by coincidence at power 4 — use power 8
     to see the gap: was 4, now 4 as well since Grass vs Fire happens to double-scale evenly;
     pick a case from the anchor table with a clear before/after gap instead, e.g. Ice/Flying
     vs Rock, to get a visibly different number).
4. Flag to the user afterward that a couple of playthrough rounds are worth spot-checking for
   feel, since ~30 type pairs are meaningfully harsher or stronger than before — this is a
   difficulty rebalance, not just a bugfix.

## Steps

1. Rewrite `type-matchup.service.ts`: add `offenseContribution`/`defenseContribution`/
   `getMemberNetScore`/`getMemberDeltaSigned`, repurpose `getMemberDelta`, rewrite
   `calcTeamMatchupTotals` and `getMatchupTypes`, remove `getDefenseTier`/`getMemberTier`/
   `getTierDeltaMagnitude`.
2. Rewrite `type-matchup.service.spec.ts` per the plan above, using the anchor table's
   verified numbers.
3. Run `npm run test:local` and `npm run build`; fix any fallout.
4. Manual Playwright spot-check per Verification §3.
5. Move this plan to `docs/plans/done/` once shipped, and note in
   `docs/todo/backlog.md`/README (per `CLAUDE.md`'s "README before mechanics commit" rule —
   this changes game mechanics) that type matchup scoring changed from best-case-offense to
   symmetric per-type scoring.
