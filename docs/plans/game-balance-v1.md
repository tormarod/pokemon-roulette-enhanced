# Plan: Game balance V1 — threat & economy rebalance

Status: **Ready to implement (Sonnet).** All values are concrete starting points;
the two dials marked ⚙️ are the ones to tune by playtest.
Owner: tormarod
Last updated: 2026-07-16
Rationale: see `docs/plans/game-balance-research.md`.

## Philosophy (the constraints every change obeys)

- **Luck + type knowledge only.** No rubber-banding, no crutches, no helping the
  unlucky. If you're unlucky early, it is what it is.
- **Rising ABSOLUTE threat.** Late battles get harder on a *fixed* schedule (same
  for everyone), so even a lucky-strong team sweats — but a weak team is not
  rescued.
- **Steering, not escaping.** V1 does not add escape tools (no reroll — deferred).
- **Scope: economy + threat only.** Battle *agency* (abilities, pre-spin choice)
  and reroll are **V2**. Do not add them here.
- **Canon is untouchable:** gym-leader types and any real-Pokémon-world relations
  stay real (Brock = Rock, etc.). No change touches type/leader data.

## Changes (5 concrete edits)

### 1. First wheel — cut early potion
File: `src/app/main-game/roulette-container/roulettes/start-adventure-roulette/start-adventure-roulette.component.ts`
Change the `actions` weights:
- `catchPokemon`: `2` → **`3`**
- `battleTrainer`: `2` → **`2`** (unchanged)
- `buyPotions`: `2` → **`1`**
Result: catch 50% / battle 33% / potion 17% (was 33% each). Catch (the core loop)
now dominates the first spin; a potion is no longer as likely as anything else.

### 2. Adventure wheel — cut reward-flooding & snowball-feeders; raise the one real threat
File: `.../roulettes/main-adventure-roulette/main-adventure-roulette.component.ts`

**Correction (2026-07-16):** on the adventure wheel, `battleTrainer` and
`battleRival` are **not** threats. `battleTrainer` binds straight to
`chooseWhoWillEvolve` (a free evolution or potion — no battle, no loss);
`battleRival` gives a free evolution on a win and just continues the run on a
loss. The **only** genuine "lose something" outcome is `teamRocket` (steal). The
run-ending threat lives entirely in the gym/Elite-Four/Champion battles (the only
`game-over` triggers). Free evolutions from trainer/rival also directly **feed the
power snowball**. So the rebalance is: raise the one real threat, cut the
strongest free rewards.

In `baseActions` (leave every other entry at `1`, `catchPokemon` at `3`):
- `teamRocket`: `1` → **`2`** (the only real threat — double its share)
- `battleTrainer`: `1` → **`0.5`** (free evolution/potion + snowball driver — cut)
- `battleRival`: `1` → **`0.5`** (free evolution + snowball driver — cut)
- `buyPotions`: `1` → **`0.5`** (free healing — cut)
Result: Team Rocket ~5.6% → ~11%; each of the three free-reward outcomes
~5.6% → ~2.9%. The wheel stays a progression engine (fine — the real run-ending
threat is the battles, tightened in #5); it just stops flooding free power and
heals. (Fractional weights already exist, e.g. `0.25` in items-data.)

### 3. Healing scarcity — close the find-item bypass
File: `src/app/services/items-service/items-data.ts`
`find-item` draws the regular-item roster by weight, so healing is as common as
anything and ignores the progress gate. Lower the three healing weights (rarer,
and rarer the stronger the tier):
- `potion`: `1` → **`0.5`**
- `super-potion`: `1` → **`0.35`**
- `hyper-potion`: `1` → **`0.25`**
(`buyPotions` still tiers heals by gyms defeated — unchanged, that part's good.)

### 4. Team Rocket — a genuine threat, not a vending machine
File: `.../roulettes/team-rocket-roulette/team-rocket-roulette.component.ts`
In `ngOnInit`, raise the steal weight so an encounter is a real risk:
- `steal`: `2` → **`3`**
- `runAway`: `2` → **`2`** (unchanged)
- `defeat` (no stolen mon): `1` → **`1`** (unchanged)
- `defeat` (recovering a stolen mon): `4` → **`4`** (unchanged — recovery stays
  likely, that's fair)
New no-prior-steal split: steal 50% / run 33% / defeat 17% (was 40/40/20).
Steal chance stays *flat* (not strength-scaled — that would be rubber-banding);
combined with change #2's extra encounters, TR is a bigger cumulative threat late
without becoming free loot.

### 5. ⚙️ Rising battle-threat curve (PRIMARY DIAL)
File: `.../roulettes/base-battle-roulette/base-battle-roulette.component.ts`
In `buildVictoryOdds`, the No-ticket loop currently uses
`baseNoCount + currentRound + noBonus`. Make the round term steeper on a fixed
schedule:
- Add a class constant: `private static readonly ROUND_THREAT_MULT = 1.5;`
- Change the No-count to `baseNoCount + Math.ceil(currentRound * BaseBattleRouletteComponent.ROUND_THREAT_MULT) + noBonus`.
Effect (currentRound is 0-indexed): **first gym unchanged** (round 0 → 0); late
game meaningfully tighter (round 7 → +11 No instead of +7). A lucky avg-power-7
team drops from ~84% to ~78% at the last gym (still winning, now sweating); an
average team feels real pressure. **This is the dial that most shapes the feel —
tune `ROUND_THREAT_MULT` first (try 1.25–1.75).**

## ⚙️ These compound — tune together

Changes 3, 4, and 5 all push difficulty up and stack. Implement all five, then
playtest as one. The two primary dials are **`ROUND_THREAT_MULT` (#5)** and **the
potion weights (#3)**. If it feels too hard, lower the multiplier toward 1.25 and
raise potion weights before touching anything else.

## Validation

- `npm run test:local` green (some battle-odds specs may assert exact ticket
  counts — update them to the new `Math.ceil(round*1.5)` No-count; that's
  expected, not a regression).
- Manual playtest via the dev panel: force a run to gym 1–2 (should feel about as
  now) and gym 7–8 + Elite Four/Champion (should feel clearly tighter than now).
  Use the dev panel to add a deliberately strong team and confirm the late game
  still sweats (~75–80%, not ~85%+).

## Explicitly deferred to V2 (do NOT add in V1)

- Abilities (the marquee battle-agency layer).
- Reroll consumable / any new escape tool.
- Pre-spin battle "choose your lead" agency.
- Round-varying adventure-wheel distribution (more threat encounters late) — the
  rising threat in V1 comes from #5 only.
- Nerfing existing escape hatches (escape-rope negating TR steal, etc.).
