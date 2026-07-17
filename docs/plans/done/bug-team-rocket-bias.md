# Plan: [BUG] Honey/Repel affecting Team Rocket steal — confirm, then fix or close

Status: **Closed — confirmed not a bug (case a: indirect team-composition
correlation).** Re-verified the trace against current code: `'select-from-pokemon-list'`
is not in `obtainWheelStates`, and `pokemon-from-aux-list-roulette.component.ts`
has zero references to type bias. Added a regression test
(`roulette-container.component.spec.ts`, "steal weighting is bias-independent")
and a one-line contract comment at `weightByInversePower()` so this can't
silently regress. No behavior change.
Owner: tormarod
Last updated: 2026-07-17

## What the code actually does (traced 2026-07-17)

The Team Rocket steal target is selected with **inverse-power weighting only**:
- `roulette-container.component.ts` `stealPokemon()` →
  `this.auxPokemonList = this.weightByInversePower(trainerTeam)`, where
  `weightByInversePower` = `pokemon.map(p => ({ ...p, weight: 1 / p.power }))`.
  Nothing type-related.
- The steal wheel is rendered by `pokemon-from-aux-list-roulette` — which has **no
  reference to type bias** (`applyTypeBias` / `currentPendingTypeBiases`).
- `obtainWheelStates` (the set that gates bias application) is
  `{catch-pokemon, trade-pokemon, find-fossil, legendary-encounter,
  catch-cave-pokemon, go-fishing, mysterious-egg, area-zero}` — it does **not**
  include `steal-pokemon` / `select-from-pokemon-list`.

**Conclusion:** in the current code, Honey/Repel do not touch which Pokémon Team
Rocket steals. So either:
- **(a) Indirect correlation (most likely, not a bug):** the bias changes *which
  Pokémon you catch* → your team composition → what's available to steal. Since
  steal favors *weak* mons (`1/power`), if your biased catches skew weak, they get
  stolen more — which *looks* like the bias drives the steal, but it's
  second-order and correct.
- **(b) A real leak this trace missed** (unlikely, but possible).

## Step 1 — Reproduce + instrument (confirm which)

Using the dev panel: set a strong toward-bias (e.g. toward Water via a Poké Radar
hard bias), build a mixed team, then force Team Rocket steals repeatedly.
Temporarily log the candidate weights at `stealPokemon()`:
```ts
console.debug('steal candidates', this.auxPokemonList.map(p => [p.text, p.type1, p.weight]));
```
- If every `weight === 1 / power` regardless of type → **not a bug (case a)**.
  Explain in the backlog and close the item (the effect is team-composition
  correlation, which is intended).
- If weights show a **type skew** → **real leak (case b)**: grep for any other
  place team-member `weight` is mutated (`\.weight\s*=`), or any bias subscription
  that rewrites the aux list, and remove it.

## Step 2 — Regardless of outcome: add a regression guard

Even if it's correlation, codify the intended contract so a future change can't
introduce a real leak:
- Unit test (`roulette-container` spec or a small helper spec): with a pending
  toward/away bias set in `TrainerService`, the steal candidate list's weights
  depend **only** on power (`weightByInversePower`), not on type — i.e. two mons
  of equal power get equal steal weight whatever the bias.
- Optionally make it explicit in code: a one-line comment at `stealPokemon()` that
  the steal is deliberately bias-independent (it already is), so no one "helpfully"
  wires bias in later.

## Out of scope
No behavior change unless Step 1 shows a real skew. If it does, this becomes a
one-line removal + the test above.
