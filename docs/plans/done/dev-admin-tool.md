# Plan: Dev-only admin / testing tool

Status: **Ready to implement. Decisions baked in.**
Owner: tormarod
Last updated: 2026-07-16

## Decisions (from owner)

- **Capabilities (v1):** add AND remove Pokémon (team + PC), add AND remove items,
  **force the outcome of any wheel** (Win/Lose for battles + pick a slice for any
  wheel), jump to any game state, and set badges / advance round. (Stats/Pokédex
  seeding is out of v1.)
- **Fully stripped from the production bundle** — no dev code ships to GitHub Pages.
- **Floating button + panel**, visible only in local dev.

## Stripping mechanism (the key constraint — read first)

Prod builds swap in `environment.prod.ts` (`production: true`), so any
`if (!environment.production) { … }` folds to `if (false)` and esbuild drops it;
a dynamic `import()` inside a dropped branch is never emitted as a chunk. So:
**the dev panel + its logic are loaded via a dynamic `import()` guarded by
`!environment.production`, and the only prod-resident code is tiny guarded blocks
that get dead-code-eliminated.** Net: zero dev code in the deployed bundle.

## Files

Create: `src/app/dev/dev-panel.component.{ts,html,css}`, `src/app/dev/dev-override.ts`.
Edit: `src/app/app.component.ts`, `src/app/wheel/wheel.component.ts`.

## 1. Wheel force hook — `wheel.component.ts` (works on ANY wheel)

- Add import: `import { environment } from '../../environments/environment';`
- At line 322, immediately AFTER `this.winningNumber = this.getRandomWeightedIndex();`, insert:

```ts
if (!environment.production) {
  const forced = (window as unknown as { __devForceWheelIndex?: (items: WheelItem[]) => number | null })
    .__devForceWheelIndex?.(this.items);
  if (typeof forced === 'number' && forced >= 0 && forced < this.items.length) {
    this.winningNumber = forced;
  }
}
```

In prod the whole block becomes `if (false) {…}` and is removed. The dev panel
installs `window.__devForceWheelIndex`.

## 2. Dev override helper — `src/app/dev/dev-override.ts`

```ts
import { WheelItem } from '../interfaces/wheel-item';

export type WheelForceMode = 'off' | 'win' | 'lose' | 'pick';
let mode: WheelForceMode = 'off';
let pickedIndex: number | null = null;

export function setWheelForceMode(m: WheelForceMode): void { mode = m; install(); }
export function setPickedIndex(i: number | null): void { pickedIndex = i; }

function install(): void {
  (window as unknown as { __devForceWheelIndex?: (items: WheelItem[]) => number | null })
    .__devForceWheelIndex = (items: WheelItem[]): number | null => {
      if (mode === 'win') return items.findIndex(i => i.text.endsWith('.yes'));
      if (mode === 'lose') return items.findIndex(i => i.text.endsWith('.no'));
      if (mode === 'pick') { const i = pickedIndex; pickedIndex = null; return i; } // one-shot
      return null;
    };
}
```

Note: battle Yes/No items have text ending `.yes` / `.no` (e.g.
`game.main.roulette.gym.yes` — see `buildVictoryOdds`). `findIndex` returns `-1`
on non-battle wheels for win/lose (harmlessly ignored by the `>= 0` check); use
`pick` + a slice index for those.

## 3. Dev panel — `src/app/dev/dev-panel.component.ts` (standalone, floating)

`position: fixed` corner button that toggles a panel. Inject `TrainerService`,
`GameStateService`, `PokemonService`; import `nationalDexPokemon` and the
`dev-override` helpers. Each control is one method call:

| Control | Wiring |
|---|---|
| Add Pokémon | text input (name or id) → find in `nationalDexPokemon` → set `.sprite` via `PokemonService.getPokemonSprites(id)` → `trainerService.addToTeam({...found, power, shiny})`. Inputs: power (1–8), shiny checkbox. |
| Remove Pokémon | list `trainerService.getTeam()` → button per row → `trainerService.removeFromTeam(p)`. |
| Add to PC | build item as above → `trainerService.commitTeamAndStorage(getTeam(), [...getStored(), item])`. |
| Add item | select `ItemName` → `trainerService.addToItems(item)`. |
| Remove item | list `trainerService.getItems()` → button → `trainerService.removeItem(i)`. |
| Force wheel | buttons: **Win** → `setWheelForceMode('win')`, **Lose** → `'lose'`, **Off** → `'off'`; plus a number input + **Force slice** → `setWheelForceMode('pick'); setPickedIndex(n)`. Applies to the next spin of whatever wheel is showing. |
| Jump state | dropdown of `GameState` values → `gameStateService.setNextState(state)`. |
| Advance round | button → `gameStateService.advanceRound()`. |
| Add badge | button → `trainerService.addBadge(currentRound)`. |

(Round/badges are incremental controls — no new setters needed. Getting a
`PokemonItem`'s current round: read from wherever the container passes it, or
just use `advanceRound()` repeatedly.)

## 4. Mount — `app.component.ts` (dynamic import → stripped in prod)

- `environment` is already imported.
- Add `private vcr = inject(ViewContainerRef);` (import `inject`, `ViewContainerRef`).
- In the constructor body:

```ts
if (!environment.production) {
  import('./dev/dev-panel.component').then(({ DevPanelComponent }) => {
    this.vcr.createComponent(DevPanelComponent);
  });
}
```

## 5. Verification

- `npm start` → floating dev button appears; each control works.
- `npm run build` (prod) → `grep -r "__devForceWheelIndex\|DevPanelComponent\|dev-panel" dist/` returns **nothing** (confirms the strip). If it appears, the guard/dynamic-import isn't folding — fix before shipping.
- `npm run test:local` stays green (only additive/guarded changes).

## Steps

1. Add the wheel hook (§1) + `dev-override.ts` (§2).
2. Build `DevPanelComponent` (§3).
3. Mount via dynamic import in `AppComponent` (§4).
4. Verify strip + manual test (§5).
5. Mark done → `docs/plans/done/`.
