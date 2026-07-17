# Research: Holistic game balance & odds

Status: **REVIEWED — direction settled 2026-07-16.** Chosen: Option 4 (scarcer
safety nets + rising *fixed* threat), NO rubber-banding (Option 3 rejected),
"steering not escaping". Abilities and reroll → V2. V1 = cheap threat/economy
rebalance → see `docs/plans/game-balance-v1.md`. This doc is kept as rationale.
Owner: tormarod
Author: research pass, 2026-07-16

## Version roadmap (settled 2026-07-16)

- **V1 — threat & economy tuning.** Wheel weights, healing scarcity, rising fixed
  battle-threat curve. Plan: `docs/plans/game-balance-v1.md`.
- **V2 — Steering.** (a) Bias-item rework: stacking (2 Honey = 2×), use-in-wheel,
  visual feedback. (b) N-choice **reward** wheel + N-choice **threat** wheel
  ("pick your poison"), gated by a **meta-roll** (reward-step vs threat-step) so
  threat frequency is one tunable knob. (c) **New threats added** to stock the
  threat wheel. No pre-spin battle changes (moved to V3).
- **V3 — Pre-spin battle mechanics.** "Choose your lead" (doubles that Pokémon's
  matchup delta — advantage if the read is right, disadvantage if wrong) + a
  formal pre-spin item step. **Committed & persisted on confirm** (reload-proof,
  mirroring `PendingSpinService`).
- **V4 — Depth & stakes.** Abilities (curated set) + defeat mechanic (Pokémon
  faint → heal to revive; between-gym battles only, never gyms; the lever for how
  impactful potions are). The V3 lead becomes the mon at risk on a loss.
  - **Expect V2 wheels to need re-tuning / re-pooling at V4.** Once a battle loss
    can faint a Pokémon, encounters that are *reward-only* today become genuine
    threats — e.g. the **rival** (and **trainer**) battles, which V2 leaves in the
    reward pool, would become dual-nature (win = evolution, lose = a faint) and may
    need to move into the **threat** pool or become TR-style dual entries. The V2
    reward/threat pools and the Danger-meter tuning will need a revisit when V4
    lands. (Think about specifics then, not now.)

## 0. Scope

Holistic look at the game's reward/threat economy, difficulty curve, item
economy, player agency, and the battle-odds math — not just wheel weights.
Everything below is analysis + options with trade-offs; no changes proposed as
final yet.

## 1. How the game actually plays (the loop + the math)

- **Loop:** pick starter → `start-adventure` wheel → repeated `main-adventure`
  wheel between gyms (the "what happens next" engine) → build a team + items →
  fight gym/rival/Elite Four/Champion as a Yes/No wheel → repeat until you win or
  a battle loss ends the run.
- **Battle math** (`buildVictoryOdds`): `Yes = 1 + Σ team power + matchup
  advantage + x-attack`; `No = baseNo + currentRound + matchup disadvantage`
  (baseNo: gym 1, rival 1, Elite Four 2, Champion 3). Win% = Yes/(Yes+No).
- **Power** (`1..8` per Pokémon) grows by catching stronger species and evolving
  (natural, rare-candy, exp-share). It is the **dominant** Yes driver.
- **Potions = retries** (potion 1, super 2, hyper 3): a lost battle spin can be
  re-spun. Effectively a threat-eraser.

## 2. Core findings

### A. The economy is reward-heavy and completely flat over the run
`main-adventure` has ~16 outcomes (17 in gen 9), `catchPokemon` at weight 3 and
everything else at weight 1. Of the rest, most are **rewards** (buyPotions,
findItem, catchTwoPokemon, daycare, mysteriousEgg, legendary, fossil, fishing,
multitask) and only a few are **threats** (teamRocket steal, battleTrainer,
battleRival). Crucially the distribution is **identical at gym 1 and gym 8** — no
progression scaling anywhere in the encounter engine.

### B. Healing is abundant, and the very first wheel is 33% potion
`start-adventure` is 3 equal options: catch / battle / **buy potions (33%)** —
your example. On top of that, `find-item` draws from the 13-item roster where all
three healing tiers (potion/super/hyper) are weight 1, and `buyPotions` is its
own `main-adventure` outcome. So healing arrives from three directions, and since
potions are retries, abundant healing directly suppresses threat.

### C. Team power snowballs; difficulty does not keep pace → win-more (your concern, confirmed)
`No` scales only with `currentRound` — a **fixed schedule** that knows nothing
about how strong you are. `Yes` scales with your team power, which is **uncapped
by the difficulty**. So:
- **Lucky early** (catching power 6–8 mons, early evolutions) → your Yes pool
  outruns the fixed No curve → **late game gets *easier*, not harder.** A full
  strong team late-game sits ~84%+ before matchup even helps.
- **Unlucky early** (weak catches, bad matchups, no retries) → you can wall out.
The run's outcome is largely decided by the first few catches. This is exactly
the snowball you flagged.

### D. Agency exists but is thin
The recent additions (type-bias items, opponent preview, direct-pick trade-out,
power-weighted steal) are real agency and good. But the moment-to-moment
experience is still "spin and accept" — you rarely *choose between* outcomes.

## 3. The progression-scaling question (your explicit ask — pros/cons)

You're right that this is the high-stakes decision. Four distinct directions:

**Option 1 — Flat difficulty (status quo).**
- Pros: simple, predictable, easy to reason about.
- Cons: the snowball in §2C is baked in — lucky start snowballs to a cakewalk,
  unlucky start walls out. Threat isn't sustained.

**Option 2 — Rewards scale UP with progress (better items/encounters later).**
- Pros: feels like a real playthrough; late-game power fantasy.
- Cons: **directly amplifies win-more** — a lucky lead earns even stronger
  rewards → runaway. This is the "win-more condition" you called out. **Not
  recommended.**

**Option 3 — Difficulty scales with *your team strength* (rubber-banding).**
- Add a term to `No` that tracks your team's power (not just the round), so a
  strong team faces proportionally harder battles and a weak team isn't walled.
- Pros: **sustains threat regardless of luck** — the strongest anti-snowball
  lever. A lucky-strong team still feels the pressure; an unlucky team gets a
  fighting chance.
- Cons: risks a "rubber-band" feel (punishing your own success) if overtuned;
  changes the core Yes/No math; needs careful calibration so it *dampens*
  snowball rather than *erasing* progress. Must stay subtle.

**Option 4 — Scarcer safety nets + a rising *threat* curve.**
- Rarer healing (especially early, per your example), and more threat outcomes as
  the run progresses (Team Rocket / rival appearing more often late).
- Pros: keeps tension high, honors "rarer early healing", doesn't touch the
  battle formula.
- Cons: can feel punishing; pure-RNG walls still possible; late-game threat
  bump is itself a mild progression-scaling (of *threat*, not *reward*).

**My lean (for your review):** a restrained **blend of 3 + 4**, not naive
reward-scaling (2). Concretely: a *small* team-strength term in `No` so late
battles stay honest (3), plus scarcer/tiered healing and a threat curve that
rises with progress (4), plus a reward economy that's less flooded (§4). This
keeps the dice-throwing core, kills the win-more spiral, and makes the early
game matter without making it deterministic. Reward-scaling stays OFF.

## 4. Concrete levers (menu — nothing decided)

Odds / economy:
- **Start wheel:** drop early potion — e.g. catch 3 / battle 1 / potion 1 (33% →
  20%), or remove potions from the first wheel entirely (you buy your first
  potion only after gym 1).
- **Adventure wheel:** thin the reward outcomes (some read as filler —
  multitask, fishing, daycare overlap); consider an *early* vs *late* outcome
  set; curve `buyPotions` down.
- **Healing:** fewer/rarer potions overall; gate higher tiers (super/hyper)
  behind progress so early game has only weak heals.

Difficulty / battle odds (now in scope):
- **Rubber-band `No`** with a small team-power term (Option 3).
- Re-examine whether `currentRound` scaling is steep enough vs. team-power growth.

Agency (keep the dice, add steering):
- **Choose-between:** offer 2 encounter options and let the player pick one
  (agency without removing randomness).
- **A scarce reroll resource** (e.g. running-shoes-style) to re-spin one wheel
  per stretch — banked, strategic.
- Let players **bank/hold** a found item choice rather than auto-granting.

Content (add/remove):
- Candidates to **cut** from the adventure wheel: low-impact filler outcomes.
- Candidates to **add:** a high-risk/high-reward encounter (e.g. gamble a
  Pokémon for a strong item), which adds agency + tension.

## 5. What I need from you before writing a plan

1. **Direction on §3** — confirm the "blend of 3+4, no reward-scaling" lean, or
   pick a different option.
2. **Appetite for touching the battle formula** (Option 3 rubber-banding changes
   `buildVictoryOdds`) vs. keeping the formula and only changing wheels/economy.
3. **How much new agency** you want (choose-between / reroll / banking), vs.
   keeping this pass purely about odds & economy.
4. Anything here you consider off-limits (e.g. don't touch the adventure-wheel
   variety, keep all encounter types).
