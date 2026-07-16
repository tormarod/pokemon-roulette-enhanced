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

See the in-app [Credits](src/app/credits) page for full attribution, and the [Coffee](src/app/coffee) page if you'd like to support either the original creator or this fork.

You can play it here: [https://tormarod.github.io/pokemon-roulette-enhanced/](https://tormarod.github.io/pokemon-roulette-enhanced/)

## Battle balancing

Every battle (gym, rival, Elite Four, Champion) resolves as a weighted Yes/No wheel spin — team power fills the Yes pool, and each Pokémon's own matchup against the opponent's type(s) shifts the odds. Advantage always adds to the **Yes** pool and disadvantage always adds to the **No** pool, so a bad matchup shows up as visibly more red on the wheel, not a smaller green wedge — every Pokémon keeps its full power in green regardless of matchup.

Each team member is classified into a **graded tier**, not a boolean, by combining both its offensive answer and its defensive read against the opponent's type(s):

- **Strong** — offensively super-effective, or immune to the opponent's attack. Adds `ceil(power / 2)` to Yes.
- **Resistant** / **hard-resistant** — nets a defensive resist against the opponent (no offensive answer needed). Adds a smaller `ceil(power / 4)` / `2 × ceil(power / 4)` to Yes — a real reward for a defensively solid pick, not just an offensive one.
- **Neutral** — no meaningful edge either way. No effect.
- **Weak** / **hard-countered** — the opponent is super-effective against it, with no resistance to soften the hit. Adds `ceil(power / 2)` / `2 × ceil(power / 2)` to No. The "hard" tier (double the plain penalty) is deliberately harsher at every power level, so a genuine hard counter always stings more than an ordinary weakness.
- Immunity beats everything: a member immune to the opponent's attack is always **strong**, even if one of its other types would otherwise be weak.

None of this uses raw damage multipliers (no `4×`/`0.25×` ticket math) — effectiveness is bucketed into tiers first, then converted to a ticket delta, which keeps swings bounded and avoids a double-weak Pokémon turning into an unwinnable wall. Deltas scale with that Pokémon's own power (`1..8`) and depend only on that one Pokémon, never on team size or which other Pokémon are on the roster, so swapping an unrelated teammate never silently changes another Pokémon's contribution.

A trainer's `types` list can also **repeat a type on purpose** (e.g. Elite Four member Lance is `['dragon', 'dragon']`) — this is a deliberate emphasis lever, not a data typo. A repeated type means the trainer leans hard into it: a member weak to it is punished as hard-countered rather than merely weak, and symmetrically, a member that resists it is rewarded as hard-resistant rather than merely resistant.

The full calculation lives in [`TypeMatchupService`](src/app/services/type-matchup-service/type-matchup.service.ts), shared by all four battle types via [`BaseBattleRouletteComponent.buildVictoryOdds()`](src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.ts).

## Opponent agency

Team composition used to be fully locked in by catch/trade RNG before the upcoming opponent's type was ever revealed — the reveal only happened once the battle screen itself mounted, well after any roster-building decisions were made. A few additions give the player real, informed agency over that process without touching the core RNG loop or the [battle-odds math](#battle-balancing) itself:

- **Opponent preview**: a persistent banner shows the next gym leader's type (or, once you reach `elite-four-preparation`, the first Elite Four member's) throughout the roster-building stretch that precedes them, so swapping team members or using a bias item below is an informed choice instead of a guess. It's hidden during actual battles (which reveal their own opponent) and before the adventure starts. A handful of rounds resolve to one of several possible types only once the battle begins (e.g. gym leader trios); the preview shows every possible type for those rounds rather than falsely implying certainty.
- **Type-bias items**: Honey and Repel (common, granted at the start of every run) bias your next catch or trade *toward* or *away from* a type you pick by clicking it directly — no RNG in the pick itself. Poké Radar and Max Repel (rarer, found via the wheel) do the same as a hard guarantee/exclusion instead of a soft bias. A "toward" and an "away" bias can be active at the same time (e.g. Honey *and* Max Repel together), each shown in its own indicator next to the Items panel. Whichever effect(s) you've set stay active for the rest of the current gym stretch — any number of catch/trade spins — and clear automatically once you reach the next battle, so an unused bias never leaks into a fight or a future stretch.
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
