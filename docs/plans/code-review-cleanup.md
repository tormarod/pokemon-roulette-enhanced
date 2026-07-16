# Plan: Code-review backlog cleanup

Status: **DONE.** All 8 fixes implemented and tested (530/530 tests passing).
Owner: tormarod
Last updated: 2026-07-16

**Severity note:** the backlog's `[CRITICAL]` labels are wrong. The two "memory
leaks" aren't leaks — `translateService.get()` completes (WheelComponent), and
`StatsService` is an app-lifetime singleton that never unsubscribes because it
never dies. Only #1 is a real bug; the rest is optional hygiene.

---

## 1. Item sprite bug (real, 1 char)

File `src/app/items/items.component.html`, **line 38**: change
`getItemSprite(5)` → `getItemSprite(6)`. (Line 33 is a *different* slot and is
already correct — do not touch it.)
Verify: the 7th item slot shows its own sprite, not slot 6's.

## 2. ModalQueueService types

File `src/app/services/modal-queue-service/modal-queue.service.ts`:
- Add to the `@angular/core` import: `Type`, `TemplateRef`.
- Line 13: `content: any` → `content: Type<unknown> | TemplateRef<unknown>`.
- Line 45: `reason?: any` → `reason?: unknown`.

## 3. WheelComponent subscription cleanup (hygiene only — not a real leak)

File `src/app/wheel/wheel.component.ts`:
- Imports: add `DestroyRef, inject` from `@angular/core`; add
  `takeUntilDestroyed` from `@angular/core/rxjs-interop`.
- Add field: `private destroyRef = inject(DestroyRef);`
- Line 81 and line 124 — insert the pipe before `.subscribe`:
  `this.translateService.get('wheel.spin').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(...)`
  (explicit `destroyRef` is required — these run outside the injection context).

## 4. StatsService subscription cleanup (hygiene only — not a real leak)

File `src/app/services/stats-service/stats.service.ts`:
- Imports: `DestroyRef, inject` from `@angular/core`; `takeUntilDestroyed` from
  `@angular/core/rxjs-interop`.
- Add field: `private destroyRef = inject(DestroyRef);`
- Line 60: `this.trainerService.getTeamObservable().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(...)`.

## 5. items.component darkMode — one subscription instead of 13

The template has `(darkMode | async)` ~13 times. Bind a single boolean instead.
- File `src/app/items/items.component.ts`: add field `isDark = false;` and, in
  the constructor, `this.darkMode.pipe(takeUntilDestroyed()).subscribe(v => this.isDark = v);`
  (import `takeUntilDestroyed` from `@angular/core/rxjs-interop`; no `DestroyRef`
  needed — the constructor is an injection context).
- File `src/app/items/items.component.html`: replace every
  `(darkMode | async)` with `isDark`.

## 6. roulette-container modal dismissals (the one worth care)

File `src/app/main-game/roulette-container/roulette-container.component.ts`.
NgbModal `result` **rejects when the modal is dismissed** (backdrop/Esc), so
`modalRef.result.then(() => {…})` with no rejection handler throws an unhandled
rejection *and skips the callback* on dismiss.

Sites: **lines 702, 772, 1194, 1217**. For each:
1. Extract the existing `.then` callback body to a local `const onDone = () => {…};`.
2. If `onDone` advances game flow (calls any of `finishCurrentState`,
   `setNextState`, `advanceRound`, or `.emit(`) → run it on dismiss too:
   `modalRef.result.then(onDone, onDone);`
3. Otherwise (purely optional UI) → `modalRef.result.then(onDone).catch(() => {});`

Verify manually: dismiss each of these 4 modals (Esc/backdrop) and confirm the
game advances normally and the console shows no unhandled rejection.

## 7. Remove one debug log (keep error logging)

File `src/app/coffee/coffee.component.ts`, **line 30**: delete
`console.log('Pix code copied to clipboard');`. **Leave all `console.error` /
`console.warn`** elsewhere — they are legitimate error handling, not debt.

## 8. Pokédex TODOs — DO NOT REMOVE YET (verified 2026-07-16)

File `src/app/services/pokedex-service/pokedex.service.ts`, lines 36 and 149.
Verified: these are **not** dead migration code — they're the live shiny-family
propagation mechanism, and the "dedicated shiny consistency pipeline" they defer
to **was never built** (no shiny-propagation logic exists elsewhere in the app).
- `markSeen` bridge (L38-42): the only callers pass a single id + its base form,
  not the full evolution family, so this block is what flags the whole line
  shiny. Removing it regresses new shiny sightings.
- `normalizeShinyOnLoad` (L145): called on **every** load (L116) **and** by
  `replacePokedex` (L69, the V3 import path). Removing it regresses loads and
  profile imports.

**Action: leave as-is.** Closing this out is a *feature* task — build the
consolidated shiny-consistency pipeline, then retire these two blocks — not a
cleanup. Do not delete either block until that pipeline exists.

---

## Notes
- #2 and #5 may require touching a couple of existing spec expectations; #1/#7
  should not.
- All of this is optional polish; none of it blocks features.
