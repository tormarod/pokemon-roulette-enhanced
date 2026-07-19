import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { EventSource } from '../../../EventSource';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { DangerMeterService } from '../../../../services/danger-meter-service/danger-meter.service';
import { AdventureDrawService } from '../../../../services/adventure-draw-service/adventure-draw.service';
import { DangerMeterComponent } from '../../../danger-meter/danger-meter.component';
import { Subscription } from 'rxjs';

interface AdventureCandidate {
  id: string;
  textKey: string;
  fillStyle: string;
  weight: number;
}

@Component({
  selector: 'app-main-adventure-roulette',
  imports: [WheelComponent, TranslatePipe, DangerMeterComponent],
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
  ) {
  }

  @Input() respinReason!: string;
  @Output() catchPokemonEvent = new EventEmitter<void>();
  @Output() battleTrainerEvent = new EventEmitter<EventSource>();
  @Output() buyPotionsEvent = new EventEmitter<void>();
  @Output() doNothingEvent = new EventEmitter<void>();
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
  private dangerSubscription: Subscription | null = null;
  private gameStateSubscription: Subscription | null = null;
  private isGeneration9 = false;

  // ── New Experience mode: choose-between adventure (V2 Part A) ──────────
  isNewExperienceMode = false;
  candidates: AdventureCandidate[] = [];
  dangerPercent = 5;
  isNextStepGuaranteedSafe = false;

  private readonly rewardPool: AdventureCandidate[] = [
    { id: 'catchPokemon', textKey: 'game.main.roulette.adventure.actions.catchPokemon', fillStyle: 'crimson', weight: 5 },
    { id: 'battleTrainer', textKey: 'game.main.roulette.adventure.actions.battleTrainer', fillStyle: 'darkorange', weight: 2 },
    { id: 'buyPotions', textKey: 'game.main.roulette.adventure.actions.buyPotions', fillStyle: 'darkgoldenrod', weight: 0.5 },
    { id: 'catchTwoPokemon', textKey: 'game.main.roulette.adventure.actions.catchTwoPokemon', fillStyle: 'darkcyan', weight: 2 },
    { id: 'visitDaycare', textKey: 'game.main.roulette.adventure.actions.visitDaycare', fillStyle: 'blue', weight: 1 },
    { id: 'teamRocket', textKey: 'game.main.roulette.adventure.actions.teamRocket', fillStyle: 'purple', weight: 2 },
    { id: 'mysteriousEgg', textKey: 'game.main.roulette.adventure.actions.mysteriousEgg', fillStyle: 'deeppink', weight: 1 },
    { id: 'legendaryEncounter', textKey: 'game.main.roulette.adventure.actions.legendaryEncounter', fillStyle: 'crimson', weight: 1 },
    { id: 'tradePokemon', textKey: 'game.main.roulette.adventure.actions.tradePokemon', fillStyle: 'darkorange', weight: 1 },
    { id: 'findItem', textKey: 'game.main.roulette.adventure.actions.findItem', fillStyle: 'darkgoldenrod', weight: 2 },
    // New Experience only (lives in rewardPool, never baseActions) — awards an ability capsule.
    { id: 'findAbilityCapsule', textKey: 'game.main.roulette.adventure.actions.findAbilityCapsule', fillStyle: 'mediumvioletred', weight: 2 },
    { id: 'exploreCave', textKey: 'game.main.roulette.adventure.actions.exploreCave', fillStyle: 'green', weight: 1 },
    { id: 'snorlaxEncounter', textKey: 'game.main.roulette.adventure.actions.snorlaxEncounter', fillStyle: 'darkcyan', weight: 1 },
    { id: 'multitask', textKey: 'game.main.roulette.adventure.actions.multitask', fillStyle: 'blue', weight: 1 },
    { id: 'goFishing', textKey: 'game.main.roulette.adventure.actions.goFishing', fillStyle: 'purple', weight: 1 },
    { id: 'findFossil', textKey: 'game.main.roulette.adventure.actions.findFossil', fillStyle: 'deeppink', weight: 1 },
    { id: 'battleRival', textKey: 'game.main.roulette.adventure.actions.battleRival', fillStyle: 'black', weight: 1 },
  ];

  private readonly areaZeroCandidate: AdventureCandidate = {
    id: 'areaZero', textKey: 'game.main.roulette.adventure.actions.areaZero', fillStyle: 'darkslateblue', weight: 1
  };

  /**
   * Threat pool (V2 A3). `teamRocketAmbush` reuses the existing Team Rocket
   * mini-wheel (no new mechanic — same routing as the reward pool's
   * `teamRocket` entry, just a threat-flavored label). `itemTheft`,
   * `forcedRetreat`, and `badOmen` are new handlers in roulette-container.
   */
  private readonly threatPool: AdventureCandidate[] = [
    { id: 'teamRocketAmbush', textKey: 'game.main.roulette.adventure.actions.teamRocketAmbush', fillStyle: 'purple', weight: 2 },
    { id: 'itemTheft', textKey: 'game.main.roulette.adventure.actions.itemTheft', fillStyle: 'darkred', weight: 1 },
    { id: 'forcedRetreat', textKey: 'game.main.roulette.adventure.actions.forcedRetreat', fillStyle: 'darkred', weight: 1 },
    { id: 'badOmen', textKey: 'game.main.roulette.adventure.actions.badOmen', fillStyle: 'darkred', weight: 1 },
    { id: 'spooked', textKey: 'game.main.roulette.adventure.actions.spooked', fillStyle: 'darkred', weight: 1 },
    { id: 'markedTarget', textKey: 'game.main.roulette.adventure.actions.markedTarget', fillStyle: 'darkred', weight: 1 },
    { id: 'pokeballMalfunction', textKey: 'game.main.roulette.adventure.actions.pokeballMalfunction', fillStyle: 'darkred', weight: 1 },
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
    teamRocketAmbush: () => this.teamRocketEncounterEvent.emit(),
    itemTheft: () => this.itemTheftEvent.emit(),
    forcedRetreat: () => this.forcedRetreatEvent.emit(),
    badOmen: () => this.badOmenEvent.emit(),
    spooked: () => this.spookedEvent.emit(),
    markedTarget: () => this.markedTargetEvent.emit(),
    pokeballMalfunction: () => this.pokeballMalfunctionEvent.emit(),
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
      this.dangerSubscription = this.dangerMeterService.dangerPercent$.subscribe(percent => {
        this.dangerPercent = percent;
        this.isNextStepGuaranteedSafe = this.dangerMeterService.isNextStepGuaranteedSafe();
      });
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
    this.dangerSubscription?.unsubscribe();
    this.gameStateSubscription?.unsubscribe();
  }

  onGoStraight(): void {
    // Bypasses whatever was drawn — clear it so a stale draw can't resurface
    // the next time 'adventure-continues' is entered. No-op in Classic mode
    // (the service is simply never populated there).
    this.adventureDrawService.clearDraw();
    this.doNothingEvent.emit();
  }

  onCandidatePicked(index: number): void {
    const draw = this.adventureDrawService.getPendingDraw();
    if (!draw || draw.picked !== null) {
      return;
    }
    // Commit the pick the instant it's made — anti-reroll, mirrors PendingSpinService.
    this.adventureDrawService.commitPick(index);
    this.routeCandidate(draw.candidates[index]);
  }

  private initializeDraw(): void {
    const existing = this.adventureDrawService.getPendingDraw();
    if (existing) {
      if (existing.picked !== null) {
        // Reload after the pick was committed but before it was routed — replay it.
        this.routeCandidate(existing.candidates[existing.picked]);
        return;
      }
      // Reload before a pick was made — re-show the exact same 3 candidates.
      this.candidates = this.resolveCandidates(existing.candidates);
      return;
    }

    const stepType = this.dangerMeterService.rollStep(this.gameStateService.currentRoundValue);

    const pool = stepType === 'threat'
      ? this.threatPool
      : (this.isGeneration9 ? [...this.rewardPool, this.areaZeroCandidate] : this.rewardPool);
    const drawn = this.drawDistinct(pool, 3);
    this.candidates = drawn;
    this.adventureDrawService.commitDraw(stepType, drawn.map(c => c.id));
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

