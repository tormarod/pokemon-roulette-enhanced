# Plan: De-duplicate the four battle roulette components

Status: **Not started.**
Owner: tormarod
Last updated: 2026-07-19

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

- [ ] **Phase 1 — Base scaffolding.** Convert `BaseBattleRouletteComponent` to
  `inject()`; add the hoisted `@Input`/`@Output`/`prepPhase`, the abstract hooks,
  `finishBattleCleanup`, `meanTeamPower`, `resolveOpponentVariant`, and the base
  `onItemSelected`/`onPrepConfirmed`/`onGameStateChange`/`calcVictoryOdds`. Leave
  the abstract signatures for `onGameStateChange`/`calcVictoryOdds` as `override`-
  able concrete methods now. Don't touch subclasses yet — suite still green
  because nothing calls the new base methods.

- [ ] **Phase 2 — Migrate gym + elite-four.** These already use `ModalQueueService`,
  so no modal risk. Delete their `onItemSelected`/`onGameStateChange`/`calcVictoryOdds`/
  `onPrepConfirmed`/constructor; replace `getCurrentX()` with `prepareOpponentForRound()`
  + the hooks. Rename their `@ViewChild` fields to `presentationModalRef`/`itemUsedModalRef`
  (update the two `#…` refs in their `.html`). Run both specs.

- [ ] **Phase 3 — Migrate rival.** Same, plus `skipRetriesInClassicMode = true`,
  `onFinalLoss()` → `applyFaintOnLoss()`, keep faint members. **Rival modal risk is
  low** (its presentation modal at `battle-rival` entry, and `faintedModal`, are the
  only modals in that flow) but is covered by the Phase 4 gate. Run rival spec +
  the two gender regression tests already in `rival-battle-roulette.component.spec.ts`.

- [ ] **Phase 4 — Migrate champion + verification gate.** Champion is the risky
  swap: it is entered right after an Elite-Four win, whose flow can leave a queued
  `altPrizeModal` open (the mega-stone award, opened via `ModalQueueService` in
  `roulette-container.awardMegaStoneAfterImportantBattle` → `grantMegaStone`). Under
  raw `NgbModal` (today) the champion presentation modal stacks over it; under
  `ModalQueueService` it would serialize behind it — a behavior change.
  - Verify via Playwright (or a focused integration test): reach `champion-battle`
    with a mega-eligible team so a stone is awarded on the preceding Elite-Four win,
    and confirm the presentation modal still appears and is dismissable, with no
    orphaned/stacked modal, under `ModalQueueService`.
  - **If behavior-neutral:** migrate champion onto the base's `ModalQueueService`
    path (all four unified — the target state).
  - **If any difference is observed:** keep champion (and, if similarly affected,
    rival) on raw `NgbModal` by overriding `openPresentationModal()`/`openItemUsedModal()`
    in that subclass to call `this.modalService.open(...)`. Document the reason inline.
    The rest of the dedup still lands.

- [ ] **Phase 5 — Cleanup & docs.** Remove now-unused imports/constructors. Confirm
  `base-battle-roulette.component.spec.ts` still passes; add a base-level spec for
  `onItemSelected` yes/loss/potion routing and the `prepPhase` matrix if not already
  covered. Update `README.md` only if a user-facing detail changed (it shouldn't).
  When all phases are done, move this file to `docs/plans/done/`.

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
