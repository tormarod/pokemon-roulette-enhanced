# pokemon-roulette-enhanced

A luck-based Pokémon browser game built with Angular. Spin roulettes to pick your starter, battle gym leaders and rivals, catch and evolve Pokémon, and try to beat the Elite Four and Champion. No backend — it's a static SPA that pulls Pokémon sprite/type/power data locally and renders everything client-side.

This is an enhanced fork of the original game by André Xavier Martinez ([zeroxm](https://github.com/zeroxm/pokemon-roulette)). New features added on top of the original:
- Rich hover/tap tooltips on team and PC-stored Pokémon showing power and type, for informed swap decisions.
- A full Pokédex view showing every Pokémon (not just caught ones), greyed out until captured, with name search.

See the in-app [Credits](src/app/credits) page for full attribution, and the [Coffee](src/app/coffee) page if you'd like to support either the original creator or this fork.

You can play it here: [https://tormarod.github.io/pokemon-roulette-enhanced/](https://tormarod.github.io/pokemon-roulette-enhanced/)

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
