import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { AsyncPipe, NgClass } from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { EventSource } from '../../../EventSource';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { ThemeService } from '../../../../services/theme-service/theme.service';
import { AdventureStepType, DangerMeterService } from '../../../../services/danger-meter-service/danger-meter.service';
import { AdventureDrawService } from '../../../../services/adventure-draw-service/adventure-draw.service';
import { softenWheelColor } from '../../../../utils/wheel-palette';
import { Observable, Subscription } from 'rxjs';

interface AdventureCandidate {
  id: string;
  textKey: string;
  fillStyle: string;
  weight: number;
  /** Flat glyph id for the reward-row swatch. Threat candidates omit it — they auto-route and never render. */
  icon?: string;
}

@Component({
  selector: 'app-main-adventure-roulette',
  imports: [WheelComponent, TranslatePipe, AsyncPipe, NgClass],
  templateUrl: './main-adventure-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './main-adventure-roulette.component.css'
})
export class MainAdventureRouletteComponent implements OnInit, OnDestroy {

  constructor(
    private generationService: GenerationService,
    private gameStateService: GameStateService,
    private dangerMeterService: DangerMeterService,
    private adventureDrawService: AdventureDrawService,
    private themeService: ThemeService,
  ) {
    this.isDark$ = this.themeService.isDark$;
  }

  /** Binary dark/light card, same precedent as WheelComponent's wheel-card. */
  isDark$: Observable<boolean>;

  @Input() respinReason!: string;
  @Input() excludedThreatIds: string[] = [];
  @Output() catchPokemonEvent = new EventEmitter<void>();
  @Output() battleTrainerEvent = new EventEmitter<EventSource>();
  @Output() buyPotionsEvent = new EventEmitter<void>();
  @Output() catchTwoPokemonEvent = new EventEmitter<void>();
  @Output() visitDaycareEvent = new EventEmitter<EventSource>();
  @Output() teamRocketEncounterEvent = new EventEmitter<void>();
  @Output() mysteriousEggEvent = new EventEmitter<void>();
  @Output() legendaryEncounterEvent = new EventEmitter<void>();
  @Output() tradePokemonEvent = new EventEmitter<void>();
  @Output() findItemEvent = new EventEmitter<void>();
  @Output() findAbilityCapsuleEvent = new EventEmitter<void>();
  @Output() exploreCaveEvent = new EventEmitter<void>();
  @Output() snorlaxEncounterEvent = new EventEmitter<void>();
  @Output() multitaskEvent = new EventEmitter<void>();
  @Output() goFishingEvent = new EventEmitter<void>();
  @Output() findFossilEvent = new EventEmitter<void>();
  @Output() battleRivalEvent = new EventEmitter<void>();
  @Output() areaZeroEvent = new EventEmitter<void>();
  @Output() itemTheftEvent = new EventEmitter<void>();
  @Output() forcedRetreatEvent = new EventEmitter<void>();
  @Output() badOmenEvent = new EventEmitter<void>();
  @Output() spookedEvent = new EventEmitter<void>();
  @Output() markedTargetEvent = new EventEmitter<void>();
  @Output() pokeballMalfunctionEvent = new EventEmitter<void>();
  @Output() tollBoothEvent = new EventEmitter<void>();
  @Output() scoutingReportEvent = new EventEmitter<void>();
  @Output() pcLockoutEvent = new EventEmitter<void>();
  @Output() teamRocketAmbushEvent = new EventEmitter<void>();

  private readonly baseActions: WheelItem[] = [
    { text: 'game.main.roulette.adventure.actions.catchPokemon', fillStyle: 'crimson', weight: 5 },
    { text: 'game.main.roulette.adventure.actions.battleTrainer', fillStyle: 'darkorange', weight: 2 },
    { text: 'game.main.roulette.adventure.actions.buyPotions', fillStyle: 'darkgoldenrod', weight: 0.5 },
    { text: 'game.main.roulette.adventure.actions.catchTwoPokemon', fillStyle: 'darkcyan', weight: 2 },
    { text: 'game.main.roulette.adventure.actions.visitDaycare', fillStyle: 'blue', weight: 1 },
    { text: 'game.main.roulette.adventure.actions.teamRocket', fillStyle: 'purple', weight: 2 },
    { text: 'game.main.roulette.adventure.actions.mysteriousEgg', fillStyle: 'deeppink', weight: 1 },
    { text: 'game.main.roulette.adventure.actions.legendaryEncounter', fillStyle: 'crimson', weight: 1 },
    { text: 'game.main.roulette.adventure.actions.tradePokemon', fillStyle: 'darkorange', weight: 1 },
    { text: 'game.main.roulette.adventure.actions.findItem', fillStyle: 'darkgoldenrod', weight: 2 },
    { text: 'game.main.roulette.adventure.actions.exploreCave', fillStyle: 'green', weight: 1 },
    { text: 'game.main.roulette.adventure.actions.snorlaxEncounter', fillStyle: 'darkcyan', weight: 1 },
    { text: 'game.main.roulette.adventure.actions.multitask', fillStyle: 'blue', weight: 1 },
    { text: 'game.main.roulette.adventure.actions.goFishing', fillStyle: 'purple', weight: 1 },
    { text: 'game.main.roulette.adventure.actions.findFossil', fillStyle: 'deeppink', weight: 1 },
    { text: 'game.main.roulette.adventure.actions.battleRival', fillStyle: 'black', weight: 1 },
  ];

  private readonly areaZeroAction: WheelItem = {
    text: 'game.main.roulette.adventure.actions.areaZero',
    fillStyle: 'darkslateblue',
    weight: 1
  };

  actions: WheelItem[] = [...this.baseActions];
  private generationSubscription: Subscription | null = null;
  private gameStateSubscription: Subscription | null = null;
  private isGeneration9 = false;

  // ── New Experience mode: choose-between adventure (V2 Part A) ──────────
  isNewExperienceMode = false;
  candidates: AdventureCandidate[] = [];
  stepType: AdventureStepType | null = null;
  /** Index of the committed pick (drives the selected/dimmed row states); null until a row is picked. */
  pickedIndex: number | null = null;

  /** Row-swatch accent: same harmonized hex the wheel uses for this candidate's slice. */
  accentOf(candidate: AdventureCandidate): string {
    return softenWheelColor(candidate.fillStyle);
  }

  private readonly rewardPool: AdventureCandidate[] = [
    { id: 'catchPokemon', textKey: 'game.main.roulette.adventure.actions.catchPokemon', fillStyle: 'crimson', weight: 5, icon: 'pokeball' },
    { id: 'battleTrainer', textKey: 'game.main.roulette.adventure.actions.battleTrainer', fillStyle: 'darkorange', weight: 2, icon: 'swords' },
    // New Experience repurposes this card as a coin bundle (real Market exists);
    // the id stays `buyPotions` so routing is unchanged, only the label differs.
    { id: 'buyPotions', textKey: 'game.main.roulette.adventure.actions.foundCoins', fillStyle: 'darkgoldenrod', weight: 0.5, icon: 'coins' },
    { id: 'catchTwoPokemon', textKey: 'game.main.roulette.adventure.actions.catchTwoPokemon', fillStyle: 'darkcyan', weight: 2, icon: 'pokeball-double' },
    { id: 'visitDaycare', textKey: 'game.main.roulette.adventure.actions.visitDaycare', fillStyle: 'blue', weight: 1, icon: 'house' },
    { id: 'teamRocket', textKey: 'game.main.roulette.adventure.actions.teamRocket', fillStyle: 'purple', weight: 2, icon: 'rocket' },
    { id: 'mysteriousEgg', textKey: 'game.main.roulette.adventure.actions.mysteriousEgg', fillStyle: 'deeppink', weight: 1, icon: 'egg' },
    { id: 'legendaryEncounter', textKey: 'game.main.roulette.adventure.actions.legendaryEncounter', fillStyle: 'crimson', weight: 1, icon: 'star' },
    { id: 'tradePokemon', textKey: 'game.main.roulette.adventure.actions.tradePokemon', fillStyle: 'darkorange', weight: 1, icon: 'swap' },
    { id: 'findItem', textKey: 'game.main.roulette.adventure.actions.findItem', fillStyle: 'darkgoldenrod', weight: 2, icon: 'bag' },
    // New Experience only (lives in rewardPool, never baseActions) — awards an ability capsule.
    { id: 'findAbilityCapsule', textKey: 'game.main.roulette.adventure.actions.findAbilityCapsule', fillStyle: 'mediumvioletred', weight: 2, icon: 'capsule' },
    { id: 'exploreCave', textKey: 'game.main.roulette.adventure.actions.exploreCave', fillStyle: 'green', weight: 1, icon: 'cave' },
    { id: 'snorlaxEncounter', textKey: 'game.main.roulette.adventure.actions.snorlaxEncounter', fillStyle: 'darkcyan', weight: 1, icon: 'moon' },
    { id: 'multitask', textKey: 'game.main.roulette.adventure.actions.multitask', fillStyle: 'blue', weight: 1, icon: 'panes' },
    { id: 'goFishing', textKey: 'game.main.roulette.adventure.actions.goFishing', fillStyle: 'purple', weight: 1, icon: 'fish' },
    { id: 'findFossil', textKey: 'game.main.roulette.adventure.actions.findFossil', fillStyle: 'deeppink', weight: 1, icon: 'bone' },
    { id: 'battleRival', textKey: 'game.main.roulette.adventure.actions.battleRival', fillStyle: 'black', weight: 1, icon: 'bolt' },
  ];

  private readonly areaZeroCandidate: AdventureCandidate = {
    id: 'areaZero', textKey: 'game.main.roulette.adventure.actions.areaZero', fillStyle: 'darkslateblue', weight: 1, icon: 'portal'
  };

  /**
   * Threat pool (V2 A3). `teamRocketAmbush` reuses the existing Team Rocket
   * mini-wheel (no new encounter mechanic), but routes through its own
   * `teamRocketAmbushEvent` (rather than the reward pool's `teamRocket` id)
   * so its handler can show a threat-specific info modal before handing off
   * to the shared `teamRocketEncounter()` logic. `itemTheft`, `forcedRetreat`,
   * and `badOmen` are new handlers in roulette-container.
   *
   * Weights tuned by severity (docs/plans/threat-mechanics-expansion.md Phase 5,
   * decided 2026-07-21): rarer the more it guarantees a real cost, more common
   * the more it's recoverable or probabilistic. High (1): forcedRetreat/
   * scoutingReport — a concrete cost every single draw. High-medium (1.25):
   * teamRocketAmbush — can cost a whole Pokémon, but only ~40% of the time (the
   * mini-wheel's other outcomes are neutral/good), so it's not as consistently
   * punishing as the two `weight: 1` threats. Medium (1.5): pcLockout/badOmen/
   * markedTarget — worsens one battle or removes flexibility, no roster/coin
   * loss. Low (2): tollBooth/itemTheft/pokeballMalfunction/spooked — a
   * recoverable resource loss or a purely probabilistic/meta cost.
   */
  private readonly threatPool: AdventureCandidate[] = [
    { id: 'teamRocketAmbush', textKey: 'game.main.roulette.adventure.actions.teamRocketAmbush', fillStyle: 'purple', weight: 1.25 },
    { id: 'itemTheft', textKey: 'game.main.roulette.adventure.actions.itemTheft', fillStyle: 'darkred', weight: 2 },
    { id: 'forcedRetreat', textKey: 'game.main.roulette.adventure.actions.forcedRetreat', fillStyle: 'darkred', weight: 1 },
    { id: 'badOmen', textKey: 'game.main.roulette.adventure.actions.badOmen', fillStyle: 'darkred', weight: 1.5 },
    { id: 'spooked', textKey: 'game.main.roulette.adventure.actions.spooked', fillStyle: 'darkred', weight: 2 },
    { id: 'markedTarget', textKey: 'game.main.roulette.adventure.actions.markedTarget', fillStyle: 'darkred', weight: 1.5 },
    { id: 'pokeballMalfunction', textKey: 'game.main.roulette.adventure.actions.pokeballMalfunction', fillStyle: 'darkred', weight: 2 },
    { id: 'tollBooth', textKey: 'game.main.roulette.adventure.actions.tollBooth', fillStyle: 'darkred', weight: 2 },
    { id: 'scoutingReport', textKey: 'game.main.roulette.adventure.actions.scoutingReport', fillStyle: 'darkred', weight: 1 },
    { id: 'pcLockout', textKey: 'game.main.roulette.adventure.actions.pcLockout', fillStyle: 'darkred', weight: 1.5 },
  ];

  /**
   * Routes a drawn/picked candidate id to the same output event Classic
   * mode's onItemSelected switch uses, just keyed by a stable id instead of a
   * wheel index — a draw persisted across reload can't rely on index order.
   */
  private readonly actionHandlers: Record<string, () => void> = {
    catchPokemon: () => this.catchPokemonEvent.emit(),
    battleTrainer: () => this.battleTrainerEvent.emit('battle-trainer'),
    buyPotions: () => this.buyPotionsEvent.emit(),
    catchTwoPokemon: () => this.catchTwoPokemonEvent.emit(),
    visitDaycare: () => this.visitDaycareEvent.emit('visit-daycare'),
    teamRocket: () => this.teamRocketEncounterEvent.emit(),
    mysteriousEgg: () => this.mysteriousEggEvent.emit(),
    legendaryEncounter: () => this.legendaryEncounterEvent.emit(),
    tradePokemon: () => this.tradePokemonEvent.emit(),
    findItem: () => this.findItemEvent.emit(),
    findAbilityCapsule: () => this.findAbilityCapsuleEvent.emit(),
    exploreCave: () => this.exploreCaveEvent.emit(),
    snorlaxEncounter: () => this.snorlaxEncounterEvent.emit(),
    multitask: () => this.multitaskEvent.emit(),
    goFishing: () => this.goFishingEvent.emit(),
    findFossil: () => this.findFossilEvent.emit(),
    battleRival: () => this.battleRivalEvent.emit(),
    areaZero: () => this.areaZeroEvent.emit(),
    teamRocketAmbush: () => this.teamRocketAmbushEvent.emit(),
    itemTheft: () => this.itemTheftEvent.emit(),
    forcedRetreat: () => this.forcedRetreatEvent.emit(),
    badOmen: () => this.badOmenEvent.emit(),
    spooked: () => this.spookedEvent.emit(),
    markedTarget: () => this.markedTargetEvent.emit(),
    pokeballMalfunction: () => this.pokeballMalfunctionEvent.emit(),
    tollBooth: () => this.tollBoothEvent.emit(),
    scoutingReport: () => this.scoutingReportEvent.emit(),
    pcLockout: () => this.pcLockoutEvent.emit(),
  };

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(generation => {
      this.isGeneration9 = generation.id === 9;
      this.actions = generation.id === 9
        ? [...this.baseActions, this.areaZeroAction]
        : [...this.baseActions];
    });

    this.isNewExperienceMode = this.gameStateService.isNewExperienceMode;
    if (this.isNewExperienceMode) {
      // Re-draw on every entry into this state, not just component construction.
      // Some actions (e.g. multitask) route back to 'adventure-continues' without
      // the component being destroyed/recreated — Angular's @switch only rebuilds
      // on a genuine case change, so relying on ngOnInit alone missed same-state
      // re-entries and left the already-picked, stale candidates on screen
      // (multitaskEvent fired, the round counter advanced, but nothing visibly
      // happened). currentState is a BehaviorSubject, so this also fires
      // synchronously for the normal first-render case, same as before.
      this.gameStateSubscription = this.gameStateService.currentState.subscribe(state => {
        if (state === 'adventure-continues') {
          this.initializeDraw();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.generationSubscription?.unsubscribe();
    this.gameStateSubscription?.unsubscribe();
  }

  onCandidatePicked(index: number): void {
    const draw = this.adventureDrawService.getPendingDraw();
    if (!draw || draw.picked !== null) {
      return;
    }
    this.pickedIndex = index;
    // Commit the pick the instant it's made — anti-reroll, mirrors PendingSpinService.
    this.adventureDrawService.commitPick(index);
    this.routeCandidate(draw.candidates[index]);
  }

  private initializeDraw(): void {
    this.pickedIndex = null;
    const existing = this.adventureDrawService.getPendingDraw();
    if (existing) {
      this.stepType = existing.stepType;
      if (existing.picked !== null) {
        // Reload after the pick was committed but before it was routed — replay it.
        // Deferred to a microtask: this runs from ngOnInit's own state subscription, and a
        // routed threat can itself trigger another state transition (e.g. teamRocketAmbush,
        // forcedRetreat) synchronously — reentrant while Angular is still mid-render for
        // *this* component, which leaves the parent's view stuck on the old screen even
        // though gameStateService has already moved on. Same fix as character-select
        // .component.ts's queueMicrotask use for the analogous reentrancy.
        queueMicrotask(() => this.routeCandidate(existing.candidates[existing.picked!]));
        return;
      }
      // Reload before a pick was made — re-show the exact same 3 candidates.
      this.candidates = this.resolveCandidates(existing.candidates);
      return;
    }

    const stepType = this.dangerMeterService.rollStep(this.gameStateService.currentRoundValue);
    this.stepType = stepType;

    if (stepType === 'threat') {
      const eligible = this.threatPool.filter(t => !this.excludedThreatIds.includes(t.id));
      const drawn = this.drawWeightedOne(eligible.length ? eligible : this.threatPool);
      this.adventureDrawService.commitDraw('threat', [drawn.id]);
      this.adventureDrawService.commitPick(0);
      // See the reload-replay branch above for why this is deferred to a microtask.
      queueMicrotask(() => this.routeCandidate(drawn.id));
      return;
    }

    const pool = this.isGeneration9 ? [...this.rewardPool, this.areaZeroCandidate] : this.rewardPool;
    const drawnCandidates = this.drawDistinct(pool, 3);
    this.candidates = drawnCandidates;
    this.adventureDrawService.commitDraw('reward', drawnCandidates.map(c => c.id));
  }

  private resolveCandidates(ids: string[]): AdventureCandidate[] {
    const pool = [...this.rewardPool, this.areaZeroCandidate, ...this.threatPool];
    return ids
      .map(id => pool.find(candidate => candidate.id === id))
      .filter((candidate): candidate is AdventureCandidate => !!candidate);
  }

  private routeCandidate(id: string | undefined): void {
    this.adventureDrawService.clearDraw();
    if (!id) {
      return;
    }
    this.actionHandlers[id]?.();
  }

  /** Weighted sample of `count` distinct entries from `pool`, without replacement. */
  private drawDistinct(pool: AdventureCandidate[], count: number): AdventureCandidate[] {
    const remaining = [...pool];
    const drawn: AdventureCandidate[] = [];

    for (let i = 0; i < count && remaining.length > 0; i++) {
      const totalWeight = remaining.reduce((sum, candidate) => sum + candidate.weight, 0);
      let roll = Math.random() * totalWeight;
      let index = remaining.length - 1;

      for (let j = 0; j < remaining.length; j++) {
        roll -= remaining[j].weight;
        if (roll <= 0) {
          index = j;
          break;
        }
      }

      drawn.push(remaining.splice(index, 1)[0]);
    }

    return drawn;
  }

  /** Weighted sample of a single entry from `pool`. */
  private drawWeightedOne(pool: AdventureCandidate[]): AdventureCandidate {
    return this.drawDistinct(pool, 1)[0];
  }

  onItemSelected(index: number): void {
    switch (index) {
      case 0:
        this.catchPokemonEvent.emit();
        break;
      case 1:
        this.battleTrainerEvent.emit('battle-trainer');
        break;
      case 2:
        this.buyPotionsEvent.emit();
        break;
      case 3:
        this.catchTwoPokemonEvent.emit();
        break;
      case 4:
        this.visitDaycareEvent.emit('visit-daycare');
        break;
      case 5:
        this.teamRocketEncounterEvent.emit();
        break;
      case 6:
        this.mysteriousEggEvent.emit();
        break;
      case 7:
        this.legendaryEncounterEvent.emit();
        break;
      case 8:
        this.tradePokemonEvent.emit();
        break;
      case 9:
        this.findItemEvent.emit();
        break;
      case 10:
        this.exploreCaveEvent.emit();
        break;
      case 11:
        this.snorlaxEncounterEvent.emit();
        break;
      case 12:
        this.multitaskEvent.emit();
        break;
      case 13:
        this.goFishingEvent.emit();
        break;
      case 14:
        this.findFossilEvent.emit();
        break;
      case 15:
        this.battleRivalEvent.emit();
        break;
      case 16:
        this.areaZeroEvent.emit();
        break;
    }
  }
}

