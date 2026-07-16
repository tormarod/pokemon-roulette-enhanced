# Plan: Code-review backlog cleanup

Status: **DRAFT — ready. Severities re-assessed against the code (see §1); the
auto-generated backlog labels were mostly inflated.**
Owner: tormarod
Last updated: 2026-07-16
Source: the `[CRITICAL]…[LOW]` items in `docs/todo/backlog.md` (an automated
code-review pass). Verified item-by-item against current code on 2026-07-16.

> One consolidated plan, not one per item — these are low-risk hygiene fixes that
> share themes (subscription patterns, modal handling, logging). Do them
> incrementally; nothing here blocks anything else.

## 1. Severity re-assessment (verified — read this first)

The backlog's severity labels don't survive inspection. Corrected:

| Backlog claim | Verified reality | Real severity |
|---|---|---|
| **[CRITICAL] WheelComponent sub leak** (L81/L124) | `translateService.get()` **emits once and completes**, so these subscriptions self-tear-down. Not an unbounded leak — just no `OnDestroy`/`takeUntilDestroyed` (hygiene). | **LOW** |
| **[CRITICAL] StatsService constructor sub leak** | `StatsService` is a `providedIn:'root'` **app-lifetime singleton**; it's never destroyed, so the subscription can't leak. The backlog itself concedes this. | **LOW** |
| **[CRITICAL] items.component sprite copy-paste** (`:38`) | **Real bug, confirmed.** `getItemSprite(5)` with `getItemText(6)`/`trainerItems[6]` — slot 6 shows slot 5's sprite. But it's a **one-character fix**, not a systemic risk. | **Real, trivial** |
| **[HIGH] modal chains missing `.catch()`** | Confirmed: `modalRef.result.then(onFulfilled)` with no rejection handler at ~L702/772/1194. NgbModal `result` **rejects on dismiss** → unhandled rejection, and any state work in the `.then` is skipped if the modal is dismissed. Worth fixing, but not HIGH. | **MEDIUM** |
| **[HIGH] `any` in ModalQueueService** (L13/L45) | Confirmed, but a minor type nit. | **LOW–MED** |
| **[MEDIUM] 13× darkMode async subs** | Confirmed in `items.component.html`. Minor perf/hygiene. | **MEDIUM** |
| **[MEDIUM] inconsistent sub cleanup** | Real umbrella theme (ties the two "leaks" + darkMode). | **MEDIUM** |
| **[MEDIUM] production console.\*** | 16 occurrences, but **most are legitimate `console.error`/`warn` in catch blocks** (localStorage/fetch failures) — good practice, not debt. Only a couple true debug `console.log` (e.g. coffee "Pix code copied"). | **LOW** |
| **[LOW] pokedex TODOs** (L36/L149) | Confirmed: two `TODO(next-task cleanup)` for a temporary shiny bridge + legacy migration. | **LOW** |

**Takeaway:** there are **no real CRITICALs**. There is exactly one real
correctness bug (a one-liner) plus a coherent, low-risk hygiene pass. Don't
spend CRITICAL-level urgency here.

## 2. Immediate fix (hand off directly — not phased)

`src/app/items/items.component.html:38` — change `getItemSprite(5)` →
`getItemSprite(6)`. One line; verify the 7th item slot then shows its own
sprite. This needs no plan and shouldn't wait behind the phases below.

## 3. Phases (all low-risk; checkpoint after each)

**Phase 1 — Subscription hygiene.** Standardize on `takeUntilDestroyed()`
(Angular's `DestroyRef`) for the flagged subscriptions: `WheelComponent`
(`ngAfterViewInit`/`ngOnChanges` — add `OnDestroy` or `DestroyRef`),
`StatsService` (constructor sub). Framed as consistency, not leak-fixing. Dedupe
`items.component`'s ~13 `(darkMode | async)` into a single subscription/bound
property (or wrap the list in one `@if (darkMode | async; as dark)`).
*Checkpoint: build + tests green; wheel still redraws on item changes.*

**Phase 2 — Modal error handling.** Add rejection handling to the
`modalRef.result.then(...)` chains in `roulette-container.component.ts` (~L702,
L772, L1194, and siblings). Decide per-site whether a **dismiss should still run
the follow-up** (advance game flow) or is a genuine no-op — this is a behavior
call, not just silencing a warning. *Checkpoint: dismiss each affected modal and
confirm the game doesn't soft-lock or skip a required step.*

**Phase 3 — Type-safety + logging tidy.** Replace `any` in `ModalQueueService`
with `Type<unknown> | TemplateRef<unknown>` (content) and a typed `reason`.
Remove genuine debug `console.log`s (e.g. coffee "Pix code copied"); **leave
legitimate `console.error`/`warn` in catch blocks** (or, optionally, route them
through one tiny logger — low priority). *Checkpoint: `ng build` + tests green.*

**Phase 4 — Pokédex TODO cleanup.** Resolve the two `TODO(next-task cleanup)`
in `pokedex.service.ts` (temporary shiny propagation bridge, legacy migration)
now that the migration has presumably run for existing players — confirm it's
safe to drop before removing. *Checkpoint: dex still loads for a pre-existing
save.*

## 4. Testing

- `npm run test:local` after each phase (suite is ~520 specs).
- Phase 2 needs **manual** modal-dismiss checks — unit tests won't catch a
  skipped follow-up.
- Phase 4: load a legacy Pokédex blob and confirm no regression before deleting
  the migration.

## 5. Notes

- Everything here is optional polish; none of it gates features. Reasonable to
  interleave with feature work or drop entirely if priorities are elsewhere.
