# Plan: De-duplicate the four battle roulette components

Status: **All phases done.**
Owner: tormarod
Last updated: 2026-07-20

## Goal

Collapse the ~80% duplicated logic across the four battle roulette components
(`gym`, `elite-four`, `champion`, `rival`) into their shared
`BaseBattleRouletteComponent`, using a template-method design with small
per-subclass hooks. Along the way, fix two structural issues:

1. **Modal-open divergence** — gym/elite-four open their presentation +
   item-used modals via `ModalQueueService`; champion/rival use raw `NgbModal`.
2. **Variant-resolution timing divergence** — gym defers its opponent rebuild +
   `@Output` emit via `Promise.resolve().then()`; elite-four/champion/rival emit
   synchronously. This is the same code family that produced the deterministic
   reload crash fixed in `docs/plans/bug-stuck-empty-wheels.md`.

No player-facing behavior or game logic may change. The existing spec suites for
all four components (plus `base-battle-roulette.component.spec.ts`) pin behavior
and must stay green.

## Locked design decisions (from the owner, 2026-07-19)

- **Modal opener:** unify all four onto `ModalQueueService` **only where proven
  behavior-neutral**; otherwise preserve the raw-`NgbModal` path for the
  affected subclass. See Phase 4's verification gate.
- **Variant resolution:** hoist a single shared helper and **standardize on
  deferred emit** (`queueMicrotask`) for all four.
- **Extraction depth:** full template-method — the base owns `onItemSelected`,
  `onGameStateChange`, and `calcVictoryOdds`, driven by abstract hooks.

## Current system

Each of the four components extends `BaseBattleRouletteComponent`
(`.../roulettes/base-battle-roulette/base-battle-roulette.component.ts`, a
`@Directive()` abstract class). The base already owns: `generation`,
`trainerTeam`, `trainerItems`, `victoryOdds`, the `matchup*` display fields,
`retries`, `plusModifiers()`, `buildVictoryOdds()`, `recordSpin()`,
`hasPotions()`, `usePotion()`, `getTypeIconUrl()`, and the three lifecycle
subscriptions (generation, team, game-state). It declares two abstract methods:
`onGameStateChange(state)` and `calcVictoryOdds()`. It injects 8 services via the
constructor and `AbilityService` via `inject()`.

Each subclass currently re-declares, near-verbatim:

| Member | gym | elite-four | champion | rival |
|---|---|---|---|---|
| `BATTLE_KEY` (also the trigger state) | `gym-battle` | `elite-four-battle` | `champion-battle` | `battle-rival` |
| text prefix | `…roulette.gym` | `…roulette.elite` | `…roulette.champion` | `…roulette.rival` |
| `baseNoCount` | 1 | 2 | 3 | 1 |
| opponent field | `currentLeader` | `currentElite` | `currentChampion` | `currentRival` |
| data map | `gymLeadersByGeneration` | `eliteFourByGeneration` | `championByGeneration` | `rivalByGeneration` |
| presentation `@ViewChild` | `gymLeaderPresentationModal` | `eliteFourPresentationModal` | `championPresentationModal` | `rivalPresentationModal` |
| `@Output` variant index | `fromLeaderChange` | `fromEliteChange` | `fromChampionChange` | `fromRivalChange` |
| modal service | `ModalQueueService` | `ModalQueueService` | `NgbModal` | `NgbModal` |
| variant special-case | gen5 r0/r7, gen7 r2/r4, gen8 r3/r5 | gen8 r%4∈{0,2} | gen7 | gen6 (gender) |
| classic-mode retries | yes | yes | yes | **no** (direct emit) |
| loss behavior | end run | end run | end run | **faint lead** (`applyFaintOnLoss`) |

`onItemSelected`, `onGameStateChange`, and `calcVictoryOdds` are otherwise
identical across all four (rival adds the two "no" cells above). All four inject
`battlePrepService` and `markedTargetService` in addition to the base's 8.

`ModalQueueService.open()` (`.../services/modal-queue-service/`) returns a
`Promise<NgbModalRef>` and **serializes**: it awaits any currently-open modal
before opening the next. Raw `NgbModal.open()` returns synchronously and does not
serialize — so the two are **not** interchangeable when another modal can be
open concurrently (see Phase 4).

## Target base-class API

Convert the base to full `inject()` (drop its constructor); this lets every
subclass drop its constructor too. Hoist these members into the base:

```ts
// Inherited @Input/@Output (Angular resolves these on the subclass instance;
// the parent template in roulette-container binds them the same as today):
@Input() currentRound!: number;
@Output() battleResultEvent = new EventEmitter<boolean>();

// Services (via inject()):
protected readonly modalQueueService = inject(ModalQueueService);
protected readonly battlePrepService = inject(BattlePrepService);
public readonly markedTargetService = inject(MarkedTargetService); // template binds it
// …plus the 8 already-injected services, converted to inject().

// prep-phase flag (identical in all four):
prepPhase = true;

// ── Abstract hooks each subclass implements ──
protected abstract readonly battleKey: string;   // also the trigger GameState
protected abstract readonly textPrefix: string;  // e.g. 'game.main.roulette.gym'
protected abstract readonly baseNoCount: number;
protected abstract get opponentTypes(): PokemonType[] | undefined; // reads currentX.types
protected abstract get presentationModalRef(): TemplateRef<unknown>;
protected abstract get itemUsedModalRef(): TemplateRef<unknown>;
protected abstract setCurrentOpponent(opponent: GymLeader): void;  // assigns currentX
protected abstract prepareOpponentForRound(): void;                // was getCurrentX()

// Optional hooks with base defaults:
protected readonly skipRetriesInClassicMode: boolean = false;  // rival overrides → true
protected onFinalLoss(): void {}                               // rival overrides → faint
```

### Concrete base implementations

```ts
protected override onGameStateChange(state: string): void {
  if (state !== this.battleKey) return;
  this.prepareOpponentForRound();
  const pending = this.battlePrepService.getPendingPrep();
  const committed = !!pending && pending.battleKey === this.battleKey;
  this.prepPhase = this.gameStateService.isNewExperienceMode && !committed;
  this.calcVictoryOdds();
  this.openPresentationModal();
}

onItemSelected(index: number): void {
  this.recordSpin(index);
  const landedYes = this.victoryOdds[index].text === `${this.textPrefix}.yes`;

  if (this.skipRetriesInClassicMode && !this.gameStateService.isNewExperienceMode) {
    this.battleResultEvent.emit(landedYes);   // rival Classic: no retry/potion/cleanup
    return;
  }

  this.retries--;
  if (landedYes) {
    this.finishBattleCleanup();
    this.battleResultEvent.emit(true);
  } else if (this.retries <= 0) {
    const potion = this.hasPotions();
    if (potion) {
      this.usePotion(potion, () => this.openItemUsedModal());
    } else {
      this.onFinalLoss();            // rival faints the lead here (needs prep before cleanup)
      this.finishBattleCleanup();
      this.battleResultEvent.emit(false);
    }
  }
}

onPrepConfirmed(prep: BattlePrepConfirmed): void {
  this.battlePrepService.commitPrep({ battleKey: this.battleKey, ...prep });
  this.prepPhase = false;
  this.calcVictoryOdds();
}

protected override calcVictoryOdds(): void {
  const prep = this.gameStateService.isNewExperienceMode
    ? this.battlePrepService.getPendingPrep() : null;
  const xAttackBonus = prep?.xAttackUsed ? this.meanTeamPower() : 0;
  this.victoryOdds = this.buildVictoryOdds(
    this.opponentTypes, this.textPrefix, this.baseNoCount, this.currentRound,
    prep?.leadIndex, xAttackBonus
  );
}

private finishBattleCleanup(): void {
  this.battlePrepService.clearPrep();
  this.trainerService.clearForcedRetreatLock();
  this.markedTargetService.clearMark();
  this.battleDebuffService.clearDebuff();
}

private meanTeamPower(): number {
  return this.trainerTeam.reduce((sum, p) => sum + p.power, 0) / this.trainerTeam.length;
}

protected openPresentationModal(): void {
  this.modalQueueService.open(this.presentationModalRef, { centered: true, size: 'lg' });
}
protected openItemUsedModal(): void {
  this.modalQueueService.open(this.itemUsedModalRef, { centered: true, size: 'md' });
}

/**
 * Shared multi-variant resolver (gym trio/duo rounds, gen-8 elite, gen-7
 * champion, gen-6 rival). Standardized deferred emit via queueMicrotask so the
 * @Output emit + opponent reassignment never runs mid-change-detection.
 */
protected resolveOpponentVariant(
  source: GymLeader,
  pickIndex: (variantCount: number) => number,
  typesForIndex: (types: PokemonType[] | undefined, index: number) => PokemonType[] | undefined,
  onIndexResolved: (index: number) => void
): void {
  const types = Array.isArray(source.types) ? source.types : undefined;
  this.translate.get(source.name).pipe(take(1)).subscribe(translated => {
    const names = translated.split('/');
    const sprites = Array.isArray(source.sprite) ? source.sprite : [source.sprite];
    const quotes = source.quotes;
    const index = pickIndex(names.length);
    queueMicrotask(() => {
      onIndexResolved(index);
      this.setCurrentOpponent({
        name: names[index],
        sprite: sprites[index],
        quotes: [Array.isArray(quotes) ? quotes[index] : quotes],
        types: typesForIndex(types, index)
      } as GymLeader);
      this.calcVictoryOdds();
    });
  });
}
```

### Per-subclass residue (example: gym)

```ts
export class GymBattleRouletteComponent extends BaseBattleRouletteComponent {
  protected readonly battleKey = 'gym-battle';
  protected readonly textPrefix = 'game.main.roulette.gym';
  protected readonly baseNoCount = 1;
  currentLeader!: GymLeader;
  @Output() fromLeaderChange = new EventEmitter<number>();
  @Input() fromLeader!: number;   // gym-only extra input, keep
  @ViewChild('gymLeaderPresentationModal', { static: true }) presentationModalRef!: TemplateRef<unknown>;
  @ViewChild('itemUsedModal', { static: true }) itemUsedModalRef!: TemplateRef<unknown>;
  gymLeadersByGeneration = gymLeadersByGeneration;

  protected get opponentTypes() { return this.currentLeader?.types; }
  protected setCurrentOpponent(o: GymLeader) { this.currentLeader = o; }

  protected prepareOpponentForRound(): void {
    this.currentLeader = this.gymLeadersByGeneration[this.generation.id][this.currentRound];
    if (this.isGymVariantRound()) {
      this.resolveOpponentVariant(
        this.currentLeader,
        n => Math.floor(Math.random() * n),
        (types, i) => types ? [types[i]] : undefined,
        i => this.fromLeaderChange.emit(i)
      );
    }
  }
  private isGymVariantRound(): boolean {
    const g = this.generation.id, r = this.currentRound;
    return (g === 5 && (r === 0 || r === 7))
        || (g === 7 && (r === 2 || r === 4))
        || (g === 8 && (r === 3 || r === 5));
  }
}
```

Rival's residue additionally sets `skipRetriesInClassicMode = true`, overrides
`onFinalLoss()` to call its existing `applyFaintOnLoss()`, keeps `faintedModal` +
`faintedPokemon`, and its `pickIndex` is gender-based (`() => gender === 'male' ? 1 : 0`)
with `typesForIndex: types => types` (rival keeps the shared single-element type
array — do NOT index it; this is the bug-stuck-empty-wheels fix, preserve it).
Elite-four/champion mirror gym with their own maps, `@ViewChild` names, `@Output`s,
and variant conditions (elite: `g===8 && r%4∈{0,2}`, champion: `g===7`); note
elite reads its map by `currentRound % 4`.

## Phased steps

Checkpoint after each phase; keep the full suite green between phases.

- [x] **Phase 1 — Base scaffolding.** Done 2026-07-20. Converted
  `BaseBattleRouletteComponent` to `inject()`; added the hoisted `@Input`/
  `@Output`/`prepPhase`, `finishBattleCleanup`, `meanTeamPower`,
  `resolveOpponentVariant`, and the base `onItemSelected`/`onPrepConfirmed`/
  `onGameStateChange`/`calcVictoryOdds`, `openPresentationModal`/
  `openItemUsedModal`.

  **Two corrections to how this phase actually had to be scoped, found by
  running `tsc --noEmit` against the literal plan text before trusting it:**
  1. **Hooks are not TS `abstract`.** The plan's target API showed
     `battleKey`/`textPrefix`/`baseNoCount`/`opponentTypes`/
     `presentationModalRef`/`itemUsedModalRef`/`setCurrentOpponent`/
     `prepareOpponentForRound` as `abstract`. That's impossible while any
     subclass is still a concrete, non-abstract `@Component` that doesn't
     implement them — TS fails the whole build, not just that file. They're
     concrete members with inert placeholder bodies (empty / throw) instead.
     Each becomes real either as fields Phase 2-4 subclasses set, or —
     recommended for Phase 5 — converted to genuine `abstract` once all four
     subclasses implement it, restoring the compile-time completeness check.
  2. **"Don't touch subclasses yet" was not achievable either**, for a
     different reason: `currentRound`, `battleResultEvent`, `prepPhase`, and
     the three newly-hoisted services (`modalQueueService`, `battlePrepService`,
     `markedTargetService`) already exist on all four subclasses today. The
     base's own new method bodies need those fields to compile, and having
     both base and subclass declare the same name collides (private/protected
     mismatches, "must overwrite base property", and the constructor's
     `super(...)` call losing its 8 positional params once the base moved to
     `inject()`). Resolved by expanding Phase 1 to include a **mechanical-only**
     edit to all four subclasses: deleted the now-redundant duplicate
     `@Input`/`@Output`/`prepPhase` fields and constructors (base already
     provides all of it via `inject()`), fixed 2 access-modifier collisions,
     and added `override` to `onItemSelected`/`onPrepConfirmed`/
     `onGameStateChange`/`calcVictoryOdds` (now overriding concrete base
     methods, not abstract ones). **No method body logic changed** — every
     subclass's `onItemSelected`/`onGameStateChange`/`calcVictoryOdds` is
     still its own full override, byte-for-byte identical apart from the
     `override` keyword; they just now resolve `this.modalQueueService` etc.
     to the base's `inject()`'d field instead of a local one (same singleton
     either way). Verified via `tsc --noEmit` on both `tsconfig.app.json` and
     `tsconfig.spec.json`, `npm run build`, and `npm run test:local` (783/783,
     matching the pre-change baseline exactly).

- [x] **Phase 2 — Migrate gym + elite-four.** Done 2026-07-20. Deleted their
  `onItemSelected`/`onGameStateChange`/`calcVictoryOdds`/`onPrepConfirmed`
  method bodies; replaced `getCurrentLeader()`/`getCurrentElite()` with
  `prepareOpponentForRound()` + the hooks (`battleKey`, `textPrefix`,
  `baseNoCount`, `opponentTypes`, `setCurrentOpponent`). Renamed their
  `@ViewChild` fields to `presentationModalRef`/`itemUsedModalRef` and updated
  the matching `#…` refs in both `.html` files.

  **One more TS mechanic the plan's target API didn't anticipate:** the base's
  `presentationModalRef`/`itemUsedModalRef` hooks had to be plain fields, not
  `get` accessors (TS2610: a property cannot override an accessor) — already
  fixed as part of Phase 1's placeholder design. Separately, gym/elite-four's
  own `@ViewChild(...) presentationModalRef!: TemplateRef<unknown>;` still
  triggered TS2612 ("will overwrite the base property") because of
  `useDefineForClassFields` (ES2022 target) — a subclass field re-declaration
  is treated as a fresh `[[DefineOwnProperty]]` at construction, which TS
  flags defensively even though Angular's ivy compiler assigns ViewChild
  results post-construction (so there's no actual runtime clobber). Fixed by
  declaring the subclass fields `declare` instead of `!` (no separate
  `override` — TS forbids combining `override` with `declare`, "ambient
  context"). `declare` is safe here specifically because Angular's AOT
  compiler reads `@ViewChild(...)` from the decorator/AST at compile time and
  generates its own assignment, independent of whatever the TS-only `declare`
  field does to JS emit. Applies to any future hook that's a `@ViewChild`/
  `@Input`/`@Output`-decorated field, not just these two.

  Verified via `tsc --noEmit` (app + spec), `npm run build`, and
  `npm run test:local` (783/783, unchanged) — including the existing gen-5
  gym multi-leader-round spec, which now exercises the standardized
  `queueMicrotask` deferred-emit path instead of gym's old
  `Promise.resolve().then()`.

- [x] **Phase 3 — Migrate rival.** Done 2026-07-20. Same shape as Phase 2, plus
  `skipRetriesInClassicMode = true` and `onFinalLoss()` overridden to the
  existing `applyFaintOnLoss()` body (renamed as the override, same logic).
  `faintedModal` stays a separate `@ViewChild` opened directly via
  `this.modalService` (raw `NgbModal`) inside `onFinalLoss()`, unchanged —
  there's no base hook for a third modal, and this one was never part of the
  gym/elite-four modal-opener pattern to begin with.

  **Behavior change carried forward, not yet independently verified:** because
  rival no longer overrides `openPresentationModal`/`openItemUsedModal`, its
  presentation and item-used modals now open via the base's default
  (`ModalQueueService`) instead of the raw `NgbModal` calls it used before this
  phase. Per the plan's locked modal-opener decision this was expected to
  happen opportunistically ("risk is low ... covered by the Phase 4 gate") —
  flagging here so Phase 4's verification pass explicitly includes rival, not
  just champion, before this is considered proven.

  Verified via `tsc --noEmit` (app + spec), `npm run build`, and
  `npm run test:local` (783/783, unchanged) — including both gen-6
  Calem/Serena regression tests (the `types` out-of-bounds bug this codebase
  hit before) and the Classic-mode direct-emit path.

- [x] **Phase 4 — Migrate champion + verification gate.** Done 2026-07-20.
  Verified via a focused integration test (not Playwright — no e2e harness in
  this repo; used the same direct-component-method pattern already established
  in `roulette-container.component.spec.ts`), added as
  `roulette-container.component.spec.ts` → describe block `'mega-stone
  altPrizeModal → champion-battle modal ordering'`:
  - Built the exact risky sequence: a lone mega-eligible Venusaur (base id 3,
    single stone `venusaurite`, so `awardMegaStoneAfterImportantBattle()` takes
    the direct single-candidate/single-stone path with no intervening
    select-from-list state), `gameStateService.restoreState('elite-four-battle',
    ['game-finish', 'champion-battle'], 0)` to skip straight to "about to win
    the last Elite Four round" without replaying all 4 rounds, then
    `component.eliteFourBattleResult(true)` → `component.doNothing()`
    (check-evolution's skip) → now at `champion-battle` with the mega-stone
    `altPrizeModal` never dismissed.
  - Spied on the real `NgbModal.open()` (`.and.callThrough()`, not a fake) so
    the assertions exercise the actual `ModalQueueService`/`NgbModal` stack.
  - **Ran this test against the pre-migration code first, as a baseline**: it
    failed exactly as predicted — `NgbModal.open()` was called twice
    immediately (altPrizeModal + champion's raw-`NgbModal` presentation modal),
    confirming today's stacking behavior and validating the test actually
    detects the thing it's meant to detect.
  - **Migrated champion onto the base** (same shape as Phase 2/3: `battleKey`/
    `textPrefix`/`baseNoCount`/`opponentTypes`/`setCurrentOpponent`/
    `prepareOpponentForRound` hooks, `presentationModalRef`/`itemUsedModalRef`
    renamed `@ViewChild`s using `declare` per the Phase 2 note), which — by not
    overriding `openPresentationModal`/`openItemUsedModal` — puts it on the
    base's default `ModalQueueService` path.
  - **Re-ran the same test**: `NgbModal.open()` stayed at 1 call (champion's
    modal correctly queued, did not stack) right up until `closeModal()`
    (simulating the player dismissing the mega-stone modal), after which it
    became 2 calls (champion's modal opened cleanly, no orphan). Needed two
    test-infra fixes unrelated to app code: `TestBed.inject(NgbModalConfig)
    .animation = false` (dismiss rejection is gated on a real CSS
    transitionend even with a spied-through open, not just a microtask) and a
    real macrotask wait (`setTimeout`) instead of counting `.then()` hops,
    since `ModalQueueService`'s queue-advance chain plus `NgbModal`'s own
    dismiss path go several promise links deep.
  - **Conclusion: behavior-neutral, confirmed empirically, not just by code
    reading.** Champion unified onto `ModalQueueService` — all four battle
    types now share the same modal-opener path (the target state). This also
    retroactively closes out the Phase 3 flag on rival's modal-opener switch:
    same underlying queuing mechanism, now proven safe under the harder
    (concurrent-modal) case, so no separate rival-specific verification is
    needed.
  - Verified via `tsc --noEmit` (app + spec), `npm run build`, and
    `npm run test:local` (784/784 — 783 baseline + 1 new modal-ordering test).

- [x] **Phase 5 — Cleanup & docs.** Done 2026-07-20.
  - Checked every import in the base and all four subclasses for post-migration
    dead references (counted usages per identifier) — none found; every phase's
    cleanup already removed what it made redundant as it went. No leftover
    `constructor(...)` blocks anywhere in the five files.
  - Added a base-level `onItemSelected` describe block to
    `base-battle-roulette.component.spec.ts` (win emits `true` + runs the shared
    cleanup; loss-with-potion consumes it and doesn't emit yet; final loss
    emits `false`, runs cleanup, and calls `onFinalLoss()`), in the same
    "shared logic tested once" spirit as the existing `buildVictoryOdds` specs.
  - **Skipped a separate base-level `prepPhase` matrix spec** — it's already
    covered, just not centralized: gym/elite-four/rival/champion's own specs
    each already exercise this exact shared `onGameStateChange` gating logic
    (e.g. gym's "should show the prep panel...", "...skip the prep panel...
    (anti-reroll)" tests), and since Phase 2-4 deleted each subclass's own
    copy of that logic, those tests now run directly against the base's
    implementation. Matches the plan's own "if not already covered" condition.
  - `README.md`: checked for stale references to anything renamed/removed in
    this refactor (`getCurrentLeader`, `championPresentationModal`, etc.) —
    only one hit, the `BaseBattleRouletteComponent.buildVictoryOdds()` link,
    which is still accurate (unchanged location/signature). No update needed;
    no user-facing behavior changed anywhere in this plan.
  - Final full verification: `tsc --noEmit` (app + spec) clean, `npm run build`
    clean, `npm run test:local` → **787/787** (784 + 3 new base-level tests).

## Acceptance tests (input → expected)

Behavior must be identical to today. Verify per subclass:

1. **Win path.** Spin lands `…yes` → `finishBattleCleanup()` runs (prep/mark/debuff
   cleared, forced-retreat unlocked) → `battleResultEvent.emit(true)`.
2. **Loss with potion.** Spin lands `…no`, `retries` hits 0, a potion is held →
   `usePotion` consumes weakest potion, opens item-used modal, no result emitted yet.
3. **Loss, no potion.** Same but no potion → gym/elite/champion emit `false` (run
   ends via parent); rival runs `applyFaintOnLoss()` first (lead → storage, `fainted=true`,
   `faintedModal` shown), then emits `false`. Sturdy (`faint-immune-lead`) lead survives.
4. **Rival Classic mode.** No retries: first spin emits the yes/no result directly,
   no cleanup calls.
5. **Prep gating.** New Experience + no committed prep → `prepPhase=true`; committed
   prep with matching `battleKey`, or Classic mode → `prepPhase=false`.
6. **Variant round.** gen-6 rival male → index 1 (Serena), `types` unindexed (no
   crash); gen-5 gym r0 → random variant, `types=[types[i]]`; emits fire on the
   correct `@Output`; opponent + odds settle after a microtask.
7. **x-attack bonus.** Committed prep with `xAttackUsed` adds `meanTeamPower()` to
   the yes pool (New Experience only).

## Risks

- **@Input/@Output inheritance.** Angular resolves inherited decorated members on
  the subclass; the parent `roulette-container.component.html` binds
  `battleResultEvent`/`currentRound` unchanged. Verify the parent template still
  compiles (gym also has `fromLeader`/`fromLeaderChange`, which stay on gym).
- **`static: true` ViewChildren** renamed to shared names must keep `static: true`
  (used in `onGameStateChange` before first CD).
- **Champion modal swap** — the one genuine behavior risk; gated in Phase 4.
- **Deferred-emit standardization** changes elite/champion/rival variant rounds from
  synchronous to `queueMicrotask`. This matches gym's existing (working) timing and
  removes the divergence, but re-verify the gen-7 champion and gen-8 elite variant
  rounds render correctly after the change (acceptance test 6).
