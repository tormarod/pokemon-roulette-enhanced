# pokemon-roulette-enhanced

A luck-based Pokémon browser game built with Angular. Spin roulettes to pick your starter, battle gym leaders and rivals, catch and evolve Pokémon, and try to beat the Elite Four and Champion. No backend — it's a static SPA that pulls Pokémon sprite/type/power data locally and renders everything client-side.

This is an enhanced fork of the original game by André Xavier Martinez ([zeroxm](https://github.com/zeroxm/pokemon-roulette)). New features added on top of the original:
- Rich hover/tap tooltips on team and PC-stored Pokémon showing power and type, for informed swap decisions.
- A full Pokédex view showing every Pokémon (not just caught ones), greyed out until captured, with name search.
- A reworked type advantage/disadvantage system in battles that stays meaningful at any power level — see [Battle balancing](#battle-balancing) below.

See the in-app [Credits](src/app/credits) page for full attribution, and the [Coffee](src/app/coffee) page if you'd like to support either the original creator or this fork.

You can play it here: [https://tormarod.github.io/pokemon-roulette-enhanced/](https://tormarod.github.io/pokemon-roulette-enhanced/)

## Battle balancing

Every battle (gym, rival, Elite Four, Champion) resolves as a weighted Yes/No wheel spin — team power fills the Yes pool, and each Pokémon's own matchup against the opponent's type(s) shifts the odds:

- **Advantage** (a team member has a type super-effective against the opponent) adds to the **Yes** pool.
- **Disadvantage** (the opponent has a type super-effective against a team member) adds to the **No** pool — a bad matchup shows up as visibly more red on the wheel, not a smaller green wedge.
- The size of each bonus/penalty is **`min(3, that Pokémon's own power)`** — capped at 3, or lower if the Pokémon's power is lower. It depends only on that one Pokémon, never on team size or which other Pokémon are on the roster, so swapping an unrelated teammate never silently changes another Pokémon's contribution.

This replaces an earlier team-size-scaled version of the same idea, which turned out to be confusing in practice: a Pokémon's bonus/penalty could change just because a different, unrelated team member was added or removed, since the delta was looked up from team size rather than the Pokémon itself. Tying it to the Pokémon's own power instead fixes that, and also gives natural, built-in protection for early game (a power-1 starter can only ever swing by ±1) without needing a separate rule for it.

The full calculation lives in [`TypeMatchupService`](src/app/services/type-matchup-service/type-matchup.service.ts), shared by all four battle types via [`BaseBattleRouletteComponent.buildVictoryOdds()`](src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.ts).

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
