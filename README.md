# pokemon-roulette-enhanced

A luck-based Pokémon browser game built with Angular. Spin roulettes to pick your starter, battle gym leaders and rivals, catch and evolve Pokémon, and try to beat the Elite Four and Champion. No backend — it's a static SPA that pulls Pokémon sprite/type/power data locally and renders everything client-side.

This is an enhanced fork of the original game by André Xavier Martinez ([zeroxm](https://github.com/zeroxm/pokemon-roulette)). New features added on top of the original:
- Rich hover/tap tooltips on team and PC-stored Pokémon showing power and type, for informed swap decisions.
- A full Pokédex view showing every Pokémon (not just caught ones), greyed out until captured, with name search.
- A reworked type advantage/disadvantage system in battles that stays meaningful at any power level, rewards defensive resists (not just offensive answers), and gives trainers a documented way to lean hard into a type — see [Battle balancing](#battle-balancing) below.
- "Go Straight" (skip ahead to the next fight without spinning) is now a standalone button below the wheel instead of a wheel option, so opting out of the gamble is a deliberate choice rather than a slice you can land on by chance.
- Your run now survives a reload or closed tab — team, items, badges, and progress are saved to `localStorage` automatically as you play. See [Run persistence](#run-persistence) below.
- Settings gained a volume slider (independent of the mute toggle), a "Fast Spin" option that shortens the wheel's reveal animation to under half a second without changing the odds or outcome, and a restart control, so you don't have to leave the Settings screen to start over.
- You can now see and act on what's coming before you commit to a roster — see [Opponent agency](#opponent-agency) below.
- A new Statistics page tracks activity across runs — victories, streaks, most-owned and signature Pokémon, your "nemesis" opponent, and more — persisted separately from the current run so it survives resets, with an explicit reset control of its own. It also tracks luck (are you landing Yes more or less than the odds implied?), a browsable run-history log with recent form and a win-rate trend chart, achievements with unlock toasts, a per-generation breakdown (runs/wins/streaks/records plus most-owned Pokémon, favorite types, and nemesis, filterable by generation), and lets you export/import your whole profile (stats, achievements, and Pokédex together) as a single JSON file or share a stats card image, with per-section resets alongside the full reset.
- A new opt-in **New Experience Mode** setting adds a pre-battle prep step to every battle (gym, rival, Elite Four, Champion): pick which team member leads the fight and optionally spend an X Attack or a potion before you see the odds, plus a choose-between adventure with a Danger meter and new threats between fights — see [New Experience Mode](#new-experience-mode) below. Off by default; existing players see no change in behavior unless they opt in.

See the in-app [Credits](src/app/credits) page for full attribution, and the [Coffee](src/app/coffee) page if you'd like to support either the original creator or this fork.

You can play it here: [https://tormarod.github.io/pokemon-roulette-enhanced/](https://tormarod.github.io/pokemon-roulette-enhanced/)

## Battle balancing

Every battle (gym, rival, Elite Four, Champion) resolves as a weighted Yes/No wheel spin — team power fills the Yes pool, and each Pokémon's own matchup against the opponent's type(s) shifts the odds. Advantage always adds to the **Yes** pool and disadvantage always adds to the **No** pool, so a bad matchup shows up as visibly more red on the wheel, not a smaller green wedge — every Pokémon keeps its full power in green regardless of matchup.

There's no move/ability system — a Pokémon only has its one or two static types — so the model scores offense and defense **symmetrically**: every one of a member's types is always "active" on both sides, with no cherry-picking a single best attacking type. For each of the member's types against each opponent type, a super-effective hit is `+1`, an opponent that resists/is-immune-to that attack is `-1`/`-2`; symmetrically on defense, resisting/being immune to the opponent's hit is `+1`/`+2`, being hit super-effectively is `-1`. Summed across every type pair (with a repeated opponent type — e.g. Elite Four member Lance's `['dragon', 'dragon']` — counted twice, an intentional emphasis lever, not a data typo), this gives a single signed **net score** per member: positive is a net advantage, negative a net disadvantage, zero neutral. A member's own type against the identical opponent type always cancels to exactly zero (its offensive and defensive halves are mirror images with opposite sign) and is excluded from the on-screen breakdown, so a type never gets credited with "resisting" an opponent it's also being resisted by right back.

The net score is converted to a ticket delta by multiplying by a per-Pokémon unit, `ceil(power / 4)` — never zero, so even a power-1 Pokémon's matchup always matters, and it depends only on that one Pokémon's own power, never on team size or which other Pokémon are on the roster. Because both offense and defense count, a type pair that's favorable both ways (e.g. Water hits Fire super-effectively *and* resists Fire's counter-hit) scores higher than one that's only favorable on one side — and conversely, an unfavorable pair that cuts both ways (e.g. Fire beats Grass and resists Grass's counter) is a harsher penalty than a plain one-sided weakness. A purely defensive shortcut like immunity no longer unconditionally wins, either — it can be offset by a genuinely bad matchup against a different one of the opponent's types.

The full calculation lives in [`TypeMatchupService`](src/app/services/type-matchup-service/type-matchup.service.ts), shared by all four battle types via [`BaseBattleRouletteComponent.buildVictoryOdds()`](src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.ts).

## New Experience Mode

New Experience Mode is an opt-in setting (Settings screen) that adds a pre-battle prep step and higher stakes to every battle — gym, rival, Elite Four, and Champion alike. It's off by default (Classic mode); toggling it only takes effect on your *next* run, and whichever value was in effect when a run started stays locked in for that run's whole duration, so you can't dodge a bad matchup — or get surprised by a mechanic you didn't opt into — by flipping the setting mid-run.

With it on, every battle opens with a prep panel instead of going straight to the odds wheel:
- **Choose your lead**: pick one team member to lead the fight. That Pokémon's own type-matchup delta (see [Battle balancing](#battle-balancing) above) is applied a *second* time on top of the whole team's total — a favorable lead swings the Yes pool further, an unfavorable one adds more to the No pool. Every team member's live delta is shown before you pick, so it's an informed read of the matchup, not a blind choice — and picking is mandatory every battle, keeping that read-the-opponent moment in front of you each time.
- **Pre-spin items**: optionally spend an X Attack or a potion tier *before* the wheel spins, rather than only reactively after a loss. X Attack becomes a one-time, consumed power boost (instead of Classic mode's quirk of every X Attack in your bag passively applying every battle, forever, without being used up). A pre-committed potion banks its usual retry immediately.

Both the lead pick and any item use are a single editable draft — change your mind freely — until you hit Confirm, which commits everything atomically. From that instant it's persisted the same way a wheel spin's outcome is: a reload mid-prep re-shows the same draft state, and a reload after Confirm skips straight back to the already-computed odds, never a fresh roll.

Rival battles gained a retry/potion mechanic (matching gym/Elite Four/Champion, which already had one) as part of New Experience Mode specifically — Classic-mode rival battles are unaffected and stay win/loss-only, exactly as before.

With New Experience Mode on, the adventure step between fights also changes from a passive wheel spin to a **choose-between**: each step draws 3 candidate outcomes and you pick one, paced by a **Danger meter** shown above the picks. The meter climbs with rounds survived, drops sharply whenever a threat is drawn, and recovers gradually on safe steps; three threats in a row force the next step safe (a hard pity), so danger never spirals unrecoverably. Alongside the familiar reward outcomes (catch, trade, legendary encounter, Team Rocket, etc.), the threat side can draw a Team Rocket ambush (the same steal/run/defeat mini-wheel, framed as a threat instead of a gamble), an item theft (loses one random item, or finds nothing with an empty bag), a toll (hand over an item of your choice, or — with no items — a team Pokémon, weighted toward your weaker members and never recoverable the way a Team Rocket steal is), or a bad omen (extra risk carried into your very next battle only, then it clears). Classic mode's adventure step is unaffected — still a single wheel spin with "Go Straight" as its own button.

## Opponent agency

Team composition used to be fully locked in by catch/trade RNG before the upcoming opponent's type was ever revealed — the reveal only happened once the battle screen itself mounted, well after any roster-building decisions were made. A few additions give the player real, informed agency over that process without touching the core RNG loop or the [battle-odds math](#battle-balancing) itself:

- **Opponent preview**: a persistent banner shows the next gym leader's type (or, once you reach `elite-four-preparation`, the first Elite Four member's) throughout the roster-building stretch that precedes them, so swapping team members or using a bias item below is an informed choice instead of a guess. It's hidden during actual battles (which reveal their own opponent) and before the adventure starts. A handful of rounds resolve to one of several possible types only once the battle begins (e.g. gym leader trios); the preview shows every possible type for those rounds rather than falsely implying certainty.
- **Type-bias items**: Honey and Repel (common, granted at the start of every run) bias your next new Pokémon — from any wheel that hands you one (catch, trade, fossil, legendary, cave, fishing, mysterious egg, or Area Zero) — *toward* or *away from* a type you pick by clicking it directly — no RNG in the pick itself. Poké Radar and Max Repel (rarer, found via the wheel) do the same as a hard guarantee/exclusion instead of a soft bias. A "toward" and an "away" bias can be active at the same time (e.g. Honey *and* Max Repel together), each shown in its own indicator next to the Items panel. **Uses stack**: a 2nd Honey on the same type compounds the boost linearly; a 2nd Honey on a *different* type boosts both types independently rather than replacing the first. A Honey and a Repel used on the *same* type cancel each other out (equal counts net to no effect; only the uncancelled excess on the stronger side applies) instead of fighting it out through the weight math. You can use a bias item while an obtain wheel is already on screen — a type-picker opens over the wheel without leaving it, and the wheel's odds redraw live once you pick — instead of only being usable from the Items panel between screens. Each bias is single-wheel-use: it weights exactly the next (or current) obtain wheel's resolution, then clears immediately, so it can never carry over and benefit a second wheel in the same stretch. It also clears automatically on reaching a battle, as a safety net for a bias that was set but never actually used. The effect is also legible on the wheel itself before you spin: toward-type slices get a bright outline and away-type slices get a dimmed overlay, on every wheel that can hand you a new Pokémon.
- **Link Cable** (rarer still) triggers a trade encounter on demand instead of waiting for the adventure wheel to offer one.
- **Trade-out is a direct pick**: choosing which of your *own* Pokémon to offer in a trade is a clickable grid, not a wheel spin — nothing was ever being won by randomizing a choice among Pokémon you already own. Evolution choices and a Team Rocket encounter's steal target stay wheel-based, since those still involve genuine randomness.
- **Team Rocket's steal odds are weighted by power**: a stronger Pokémon puts up more of a fight, so it's harder for Team Rocket to steal than a weak one — previously every team member was equally likely to be taken.

## Run persistence

The game auto-saves your run to `localStorage` as you play — team, PC storage, items, badges, round, and current screen — via [`RunPersistenceService`](src/app/services/run-persistence-service/run-persistence.service.ts). On startup, if a save exists, it's restored before the first screen renders, so a reload or closed tab drops you back where you left off instead of wiping the run. The save is cleared automatically once a run ends (win or loss) or is restarted.

Saving happens on every committed change (team/item/badge/state mutation), not on a timer or only at major checkpoints — this matters for fairness: a save that only happened between battles would let a player spend a potion for extra retries, reload before the battle resolves, and get the potion back for free. Auto-saving on every committed mutation closes that off, since a reload can never rewind past something that already happened.

The wheel spin itself gets the same treatment via a separate, lightweight [`PendingSpinService`](src/app/services/pending-spin-service/pending-spin.service.ts): the instant you click spin, the outcome is decided and committed — before the multi-second reveal animation plays, not after. Reloading mid-animation doesn't offer a fresh roll; the next load immediately resolves to the same outcome you already locked in. What's *not* saved (mid-battle retry count from an unconsumed potion, other in-progress on-screen choices) can only be forfeited by reloading, never regained — reloading mid-fight loses you the extra retries a potion bought, but the potion itself stays spent.

## Development server

To start a local development server, run:

```bash
npm start
```

This runs `ng serve --host 0.0.0.0 --port 4200` (see `package.json`), binding to all network interfaces so you can also test from another device (e.g. a phone) on the same network via your machine's local IP. Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
npm run build
```

This compiles the project and stores the build artifacts in `dist/pokemon-roulette-enhanced/`. By default, the production build optimizes the application for performance and speed. Use `npm run watch` for an unoptimized development build that rebuilds on file changes.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
npm test
```

## Deploying

Every push to `main` automatically builds and deploys to GitHub Pages via the `.github/workflows/deploy.yml` GitHub Actions workflow (gated behind the test suite passing). This requires a `GH_TOKEN` repository secret (a personal access token) to be configured, since GitHub Pages rebuilds aren't triggered by the default `GITHUB_TOKEN` on public repos.

To deploy manually instead, using [angular-cli-ghpages](https://github.com/angular-schule/angular-cli-ghpages):

```bash
npm run deploy
```

This runs `ng deploy --base-href=/pokemon-roulette-enhanced/`, which builds the app and pushes it to the `gh-pages` branch.
