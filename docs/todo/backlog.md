# Backlog: Pending changes, bug fixes, TODOs

Owner: tormarod
Last updated: 2026-07-16

> Running list, tracked in git so collaborators can see it. Not a shipped
> changelog — just a place to park things noticed mid-session that aren't
> worth fixing right now, or that need a decision before they become a plan.
> Add an entry whenever something comes up; move it to `docs/plans/` if it
> grows into an actual multi-phase plan, and delete the entry here once done.

---

## Open items

### Type-bias items (Honey/Repel/Poke Radar/Max Repel) only affect two wheels

- **What**: `TrainerService.currentPendingTypeBiases` is only read by
  `pokemon-from-generation-roulette.component.ts` (wild catch wheel) and
  `trade-pokemon-roulette.component.ts` (trade-in wheel). Every other
  roulette — `fossil-roulette`, `legendary-roulette`,
  `catch-legendary-roulette`, `cave-pokemon-roulette`,
  `pokemon-from-aux-list-roulette`, starters, snorlax, paradox, etc. — pulls
  from a fixed per-generation list or the player's own team, with no bias
  filtering/weighting at all.
- **Why it might matter**: not obviously a bug — fossils/legendaries are
  small, curated pools where "steer toward Fire" wouldn't make much sense
  anyway. But it's a real scope gap if the intent was "bias affects any
  wild-Pokémon source," and it's currently undocumented (README doesn't call
  out the two-wheel-only scope).
- **Possible next step**: either (a) explicitly document the scope in the
  README item description / CLAUDE.md so it's a known design choice, or
  (b) decide whether cave encounters (which do pull from a generation-wide
  pool, not a tiny curated list) should also honor the bias.
- **Where to look**: `src/app/services/trainer-service/trainer.service.ts`
  (bias state), `src/app/main-game/roulette-container/roulettes/`
  (per-roulette pool logic).
