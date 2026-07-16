# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A luck-based Pokémon browser game built with Angular 21 (standalone components, no backend). It's a static SPA: spin roulettes to pick a starter, battle gym leaders/rivals, catch and evolve Pokémon, and try to beat the Elite Four and Champion. It's an enhanced fork of [zeroxm/pokemon-roulette](https://github.com/zeroxm/pokemon-roulette) — see `README.md` for the full feature list and design rationale (battle balancing math, opponent agency mechanics, run persistence guarantees). Don't duplicate those explanations here; read the README sections directly when working on those areas.

## Commands

```bash
npm start              # ng serve --host 0.0.0.0 --port 4200, live reload, binds all interfaces
npm run build           # production build -> dist/pokemon-roulette-enhanced/
npm run watch           # unoptimized dev build, rebuilds on change
npm test                 # ng test — Karma + Jasmine, WATCH mode (stays open; see "Running tests locally")
npm run test:local       # ng test --watch=false — one-shot run, auto-detected Chromium, exits when done (~10s)
npm run deploy           # manual deploy: builds and pushes to gh-pages branch via angular-cli-ghpages
```

Run a single spec file:
```bash
ng test --watch=false --include=src/app/services/type-matchup-service/type-matchup.service.spec.ts
```
Or narrow with Jasmine's `fdescribe`/`fit` in the spec itself.

There is no lint script configured (no ESLint config in the repo).

CI (`.github/workflows/node.js.yml`) builds and runs the full headless test suite on every push/PR to `main`. Deploy (`.github/workflows/deploy.yml`) runs on push to `main`, re-runs tests, then deploys to GitHub Pages — it's skipped automatically for changes that only touch `**.md`, `.gitignore`, or `LICENSE`. Deploy requires a `GH_TOKEN` repo secret (the default `GITHUB_TOKEN` can't trigger Pages rebuilds on this repo).

## Running tests locally

Local runs are fast and reliable (~10s for the full suite, clean exit). `karma.conf.js` handles browser and port automatically — you shouldn't need any manual flags or env vars.

- **Use `npm run test:local` for a normal run** (`ng test --watch=false`). Runs the whole suite once and exits.
- **Plain `npm test` / `ng test` does NOT hang — it's watch mode.** It runs the suite then waits for file changes. Expected, not a crash; use it only when you want the watcher.
- **Don't pass a manual `CHROME_BIN=` prefix or `--browsers=` flag.** `karma.conf.js` auto-detects a browser and points `CHROME_BIN` at it, preferring the **standalone Playwright Chromium** in `%LOCALAPPDATA%\ms-playwright\chromium-*` (a real Chromium test binary that launches and exits cleanly headless), falling back to Edge. It also binds an **OS-assigned port** (`port: 0`) so concurrent runs never collide. Both are guarded so the Linux CI runner is unaffected (it finds real Chrome).
  - **Do not "fix" this by switching the default back to Edge.** Edge-as-Chrome launches flakily on Windows and hangs on teardown for minutes — that was the original problem. If no Playwright Chromium is present, install one (no system install, no admin): `npx playwright install chromium`.
- **Run a single spec** (fast iteration): `ng test --watch=false --include=<path-to-spec>`.
- **If a run ever does get stuck** (e.g. a killed/timed-out run left an orphan holding the browser), clean up leftover Karma `node` processes and **only headless** browser instances before retrying — never blanket-kill `msedge.exe`/`chrome.exe`, which would close the user's real browser:

  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'ng.js.*test|test:local|karma' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  foreach ($b in 'chrome.exe','msedge.exe') {
    Get-CimInstance Win32_Process -Filter "Name='$b'" |
      Where-Object { $_.CommandLine -match '--headless' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }
  ```

## Architecture

**State machine drives everything.** `GameStateService` (`src/app/services/game-state-service/`) holds a `GameState` union type (`game-state.ts`) and a stack of states built at startup based on the selected generation's gym/Elite Four counts (`initializeStates`). `RouletteContainerComponent` (`src/app/main-game/roulette-container/roulette-container.component.ts`) subscribes to `currentState` and conditionally renders exactly one of ~30 "roulette" screen components from `roulette-container/roulettes/*` based on the current state string. This container is the central orchestration point — it wires together nearly every service (trainer team, items, evolution, pokedex, sound, modals, etc.) and is the first file to check when a change spans multiple screens or affects game flow/transitions.

**Battle math is centralized and shared.** All four battle types (gym, rival, Elite Four, Champion) compute their Yes/No wheel odds through `TypeMatchupService.calcTeamMatchupTotals()` (`src/app/services/type-matchup-service/`), invoked via `BaseBattleRouletteComponent.buildVictoryOdds()` which each battle roulette component extends. The per-Pokémon type-matchup delta (`ceil(power / 2)`) depends only on that Pokémon, never team composition — preserve that invariant if touching this logic (see README "Battle balancing" for why).

**Pokémon data is split: static local data + live sprites.** `nationalDexPokemon` (`src/app/services/pokemon-service/national-dex-pokemon.ts`) is the local source of truth for id/name/type/power for all Pokémon — no network call needed for game logic. `PokemonService.getPokemonSprites()` fetches sprite URLs from the live PokeAPI (`pokeapi.co`) with retry, only for display.

**Run state persistence is mutation-triggered, not timer-based.** `RunPersistenceService` (`src/app/services/run-persistence-service/`) saves the full run (team, PC storage, items, badges, round, screen) to `localStorage` on every committed state mutation, and restores it before the first screen renders. This is a deliberate fairness invariant, not an optimization detail — a save that only happened between battles would let a player reload to undo a spent consumable. Any new piece of persistent run state must be wired into this service the same way. Wheel spin outcomes get separate, earlier commit-on-click handling via `PendingSpinService` so a reload mid-animation can't reroll.

**i18n via ngx-translate.** User-facing strings live in `src/assets/i18n/{en,de,es,fr,it,pt}.json`. New strings need an entry at least in `en.json`; keep the other locale files in sync when practical.

## Repo conventions

- This is a fork tracking an upstream project; the `README.md` "New features added on top of the original" list is the changelog of fork-specific work — update it when adding a new user-facing feature.
- Attribution for the fork lives in the in-app Credits (`src/app/credits`) and Coffee (`src/app/coffee`) pages, not just the README.

## Working with the user

These are workflow preferences for how to run a session in this repo, learned from past sessions that grew unwieldy:

- **Push back; verify before accepting.** Don't just agree or implement whatever is asked — this is a two-way critical relationship, not order-taking. Check facts against the code, docs, and reality first; if a request rests on a wrong premise, say so with evidence rather than building on it. **It is fine — encouraged — to recommend NOT making a change** (leave it as-is, defer, or drop it) when that's the better call, and to explain the trade-off. Disagreement with reasons is more useful than compliance. (This cuts both ways: the user won't accept our claims uncritically either, so back assertions with specifics.)
- **Never `git push` unless explicitly asked** (or the user runs `/push`). Committing is fine; pushing is not, without a clear go-ahead.
- **Check open PRs before assuming one is open** Always ask before opening a new PR.
- **Checkpoint multi-phase work.** For a plan with several phases, don't treat one "go ahead" as license to run all phases autonomously in one stretch. Pause after each phase (or every couple) for review before continuing.
- **Push open-ended research into subagents.** For "how does X currently work?" questions, use an Explore/general-purpose agent so the file-by-file digging stays out of the main thread — return just the distilled answer.
- **Prefer a plan-then-execute split for nontrivial features.** Use plan mode to design and get approval, then execute against the approved plan rather than interleaving design and implementation in one long thread.
- **Suggest a fresh session at natural boundaries.** When a feature is merged/pushed or the user pivots to something unrelated to the last exchange, it's a good point to start a new session — long single sessions here have hit context compaction and lost earlier detail.
- **Approved plans live in `docs/plans/*.md` (tracked in git, shared with collaborators).** When a nontrivial feature is planned, write the approved plan to a file there (self-contained, with a "current system" section so an execution session needn't re-research). Execution sessions implement against that file and update its status/checkboxes as phases complete, marking them done. Ask to continue after each phase is done, do not run multiple phases in one go. This is how work is handed between sessions/models. **Keep marking phases done as they ship; once ALL phases of a plan are done, move the file to `docs/plans/done/` (completed plans live there, active plans stay in `docs/plans/`).**
- **Write plans concrete enough for a small (Haiku-class) model to implement with no extra reasoning.** Exact file paths, function/method names, signatures, and the specific edit — spell out the algorithm, don't say "aggregate appropriately". Pre-decide open design questions in the plan (or surface the one real decision to the user before finalizing); don't leave "recommend X, decide later" for the implementer. Give ordered, checkable steps and explicit acceptance tests as input→expected-output. Keep the rationale trimmed to just enough "why" to avoid a wrong turn — cut the design essays and worked-example digressions.
- **Pending changes, bug fixes, and TODOs go in `docs/todo/backlog.md` (tracked in git).** Add an entry whenever something noteworthy comes up mid-session that isn't worth fixing immediately or needs a decision first. Promote an entry to a full `docs/plans/*.md` file if it grows into a real multi-phase plan; delete the entry here once it's done.
