import { ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, OnDestroy, OnInit, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GenerationRouletteComponent } from "./roulettes/generation-roulette/generation-roulette.component";
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { GameState } from '../../services/game-state-service/game-state';
import { EventSource } from '../EventSource';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { PokedexService } from '../../services/pokedex-service/pokedex.service';
import { PokemonService } from '../../services/pokemon-service/pokemon.service';
import { ItemsService } from '../../services/items-service/items.service';
import { EvolutionService } from '../../services/evolution-service/evolution.service';
import { CommonModule } from '@angular/common';
import { SoundFxHandle, SoundFxService } from '../../services/sound-fx-service/sound-fx.service';
import { SettingsService } from '../../services/settings-service/settings.service';
import { RareCandyService } from '../../services/rare-candy-service/rare-candy.service';
import { Subscription } from 'rxjs';
import { CharacterSelectComponent } from "./roulettes/character-select/character-select.component";
import { StarterRouletteComponent } from "./roulettes/starter-roulette/starter-roulette.component";
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonForm } from '../../interfaces/pokemon-form';
import { ItemItem } from '../../interfaces/item-item';
import { ShinyRouletteComponent } from "./roulettes/shiny-roulette/shiny-roulette.component";
import { StartAdventureRouletteComponent } from "./roulettes/start-adventure-roulette/start-adventure-roulette.component";
import { isMegaStoneItemName, ItemName, MegaStoneItemName } from '../../services/items-service/item-names';
import { PokemonFromGenerationRouletteComponent } from "./roulettes/pokemon-from-generation-roulette/pokemon-from-generation-roulette.component";
import { PokemonFromAuxListRouletteComponent } from "./roulettes/pokemon-from-aux-list-roulette/pokemon-from-aux-list-roulette.component";
import { GymBattleRouletteComponent } from "./roulettes/gym-battle-roulette/gym-battle-roulette.component";
import { CheckEvolutionRouletteComponent } from "./roulettes/check-evolution-roulette/check-evolution-roulette.component";
import { MainAdventureRouletteComponent } from "./roulettes/main-adventure-roulette/main-adventure-roulette.component";
import { TeamRocketRouletteComponent } from "./roulettes/team-rocket-roulette/team-rocket-roulette.component";
import { MysteriousEggRouletteComponent } from "./roulettes/mysterious-egg-roulette/mysterious-egg-roulette.component";
import { LegendaryRouletteComponent } from "./roulettes/legendary-roulette/legendary-roulette.component";
import { CatchLegendaryRouletteComponent } from "./roulettes/catch-legendary-roulette/catch-legendary-roulette.component";
import { SelectFormRouletteComponent } from './roulettes/select-form-roulette/select-form-roulette.component';
import { TradePokemonRouletteComponent } from "./roulettes/trade-pokemon-roulette/trade-pokemon-roulette.component";
import { FindItemRouletteComponent } from "./roulettes/find-item-roulette/find-item-roulette.component";
import { FindAbilityCapsuleRouletteComponent } from "./roulettes/find-ability-capsule-roulette/find-ability-capsule-roulette.component";
import { ExploreCaveRouletteComponent } from "./roulettes/explore-cave-roulette/explore-cave-roulette.component";
import { CavePokemonRouletteComponent } from "./roulettes/cave-pokemon-roulette/cave-pokemon-roulette.component";
import { FossilRouletteComponent } from "./roulettes/fossil-roulette/fossil-roulette.component";
import { AreaZeroRoulette } from "./roulettes/area-zero-roulette/area-zero-roulette";
import { CatchParadoxRouletteComponent } from "./roulettes/catch-paradox-roulette/catch-paradox-roulette.component";
import { SnorlaxRouletteComponent } from "./roulettes/snorlax-roulette/snorlax-roulette.component";
import { FishingRouletteComponent } from "./roulettes/fishing-roulette/fishing-roulette.component";
import { RivalBattleRouletteComponent } from "./roulettes/rival-battle-roulette/rival-battle-roulette.component";
import { EliteFourPrepRouletteComponent } from "./roulettes/elite-four-prep-roulette/elite-four-prep-roulette.component";
import { EliteFourBattleRouletteComponent } from "./roulettes/elite-four-battle-roulette/elite-four-battle-roulette.component";
import { ChampionBattleRouletteComponent } from "./roulettes/champion-battle-roulette/champion-battle-roulette.component";
import { EndGameComponent } from "../end-game/end-game.component";
import { GameOverComponent } from "../game-over/game-over.component";
import { ModalQueueService } from '../../services/modal-queue-service/modal-queue.service';
import { PokemonFormsService } from '../../services/pokemon-forms-service/pokemon-forms.service';
import { MegaStoneService } from '../../services/mega-stone-service/mega-stone.service';
import { megaStoneNamesForBaseId, pokemonMegaForms } from '../../services/trainer-service/pokemon-mega-forms';
import { MegaEvolutionAnimationModalComponent } from './roulettes/mega-evolution-animation-modal/mega-evolution-animation-modal.component';
import { SelectFromItemListRouletteComponent } from './roulettes/select-from-item-list-roulette/select-from-item-list-roulette.component';
import { SelectFromTypeListRouletteComponent } from './roulettes/select-from-type-list-roulette/select-from-type-list-roulette.component';
import { HONEY_MAX_TYPES } from '../../services/trainer-service/apply-type-bias';
import { TypeBiasItemService } from '../../services/type-bias-item-service/type-bias-item.service';
import { LinkCableService } from '../../services/link-cable-service/link-cable.service';
import { ThreatShieldService } from '../../services/threat-shield-service/threat-shield.service';
import { PokemonType, getTypeIconUrl } from '../../interfaces/pokemon-type';
import { GenerationService } from '../../services/generation-service/generation.service';
import { GenerationItem } from '../../interfaces/generation-item';
import { GymLeader } from '../../interfaces/gym-leader';
import { gymLeadersByGeneration } from './roulettes/gym-battle-roulette/gym-leaders-by-generation';
import { eliteFourByGeneration } from './roulettes/elite-four-battle-roulette/elite-four-by-generation';
import { championByGeneration } from './roulettes/champion-battle-roulette/champion-by-generation';
import { battleWinReward, cardCoinReward, foundCoinsReward, PASSIVE_PER_ROUND } from './economy-config';
import { StatsService } from '../../services/stats-service/stats.service';
import { BattleDebuffService } from '../../services/battle-debuff-service/battle-debuff.service';
import { DangerMeterService } from '../../services/danger-meter-service/danger-meter.service';
import { DangerMeterComponent } from '../danger-meter/danger-meter.component';
import { MarkedTargetService } from '../../services/marked-target-service/marked-target.service';
import { CatchRiskService } from '../../services/catch-risk-service/catch-risk.service';
import { ScoutingReportService } from '../../services/scouting-report-service/scouting-report.service';
import { TypeMatchupService } from '../../services/type-matchup-service/type-matchup.service';
import { PcLockService } from '../../services/pc-lock-service/pc-lock.service';

/** V2 "badOmen" threat: extra No tickets on the next battle. */
const BADOMEN_DEBUFF_AMOUNT = 2;
const MALFUNCTION_ESCAPE_CHANCE = 0.35;

@Component({
  selector: 'app-roulette-container',
  imports: [
    CommonModule,
    TranslatePipe,
    GenerationRouletteComponent,
    CharacterSelectComponent,
    StarterRouletteComponent,
    ShinyRouletteComponent,
    StartAdventureRouletteComponent,
    PokemonFromGenerationRouletteComponent,
    PokemonFromAuxListRouletteComponent,
    SelectFromItemListRouletteComponent,
    SelectFromTypeListRouletteComponent,
    SelectFormRouletteComponent,
    GymBattleRouletteComponent,
    CheckEvolutionRouletteComponent,
    MainAdventureRouletteComponent,
    TeamRocketRouletteComponent,
    MysteriousEggRouletteComponent,
    LegendaryRouletteComponent,
    CatchLegendaryRouletteComponent,
    TradePokemonRouletteComponent,
    FindItemRouletteComponent,
    FindAbilityCapsuleRouletteComponent,
    ExploreCaveRouletteComponent,
    CavePokemonRouletteComponent,
    FossilRouletteComponent,
    AreaZeroRoulette,
    CatchParadoxRouletteComponent,
    SnorlaxRouletteComponent,
    FishingRouletteComponent,
    RivalBattleRouletteComponent,
    EliteFourPrepRouletteComponent,
    EliteFourBattleRouletteComponent,
    ChampionBattleRouletteComponent,
    EndGameComponent,
    GameOverComponent,
    DangerMeterComponent
],
  templateUrl: './roulette-container.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './roulette-container.component.css'
})
export class RouletteContainerComponent implements OnInit, OnDestroy {

    @Output() resetGameEvent = new EventEmitter<void>();

    private destroyRef = inject(DestroyRef);
    private rareCandySubscription?: Subscription;
    private megaStoneSubscription?: Subscription;
    private typeBiasItemSubscription?: Subscription;
    private linkCableSubscription?: Subscription;
    private threatShieldSubscription?: Subscription;
    private pendingTypeBiasItem: ItemItem | null = null;

    constructor(
      private evolutionService: EvolutionService,
      private gameStateService: GameStateService,
      private itemService: ItemsService,
      private pokemonService: PokemonService,
      private pokedexService: PokedexService,
      private translateService: TranslateService,
      private trainerService: TrainerService,
      private modalService: NgbModal,
      private modalQueueService: ModalQueueService,
      private soundFxService: SoundFxService,
      private settingsService: SettingsService,
      private pokemonFormsService: PokemonFormsService,
      private rareCandyService: RareCandyService,
      private megaStoneService: MegaStoneService,
      private typeBiasItemService: TypeBiasItemService,
      private linkCableService: LinkCableService,
      private threatShieldService: ThreatShieldService,
      private generationService: GenerationService,
      private statsService: StatsService,
      private battleDebuffService: BattleDebuffService,
      private dangerMeterService: DangerMeterService,
      private markedTargetService: MarkedTargetService,
      private catchRiskService: CatchRiskService,
      private scoutingReportService: ScoutingReportService,
      private typeMatchupService: TypeMatchupService,
      private pcLockService: PcLockService,
      private cdr: ChangeDetectorRef) {
      this.itemFoundAudio = this.soundFxService.createItemFoundSoundFx();
      this.megaStoneTapAudio = this.soundFxService.createMegaStoneTapSoundFx();
      this.megaEvolutionAudio = this.soundFxService.createMegaEvolutionSoundFx();
    }

    ngOnInit(): void {
      this.gameStateService.currentState.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => {
        this.currentGameState = state;
        // 'game-start' is the very first state of every run (virgin load and every
        // "Restart"), never re-entered later — a reliable "a new run just began"
        // signal. RouletteContainerComponent survives a restart (only the
        // underlying services get reset, not this component), so any of its own
        // per-run fields that are trusted unconditionally (unlike e.g.
        // expSharePokemon, which is only ever used behind an indexOf/index>-1
        // guard against a freshly-built list) must be reset here or they leak a
        // stale reference into the new run. stolenPokemon is exactly that case:
        // teamRocketDefeated() adds it to the team on trust alone, so a leftover
        // Pokémon from a previous run's successful steal would get silently
        // handed back the first time this run's Team Rocket wheel lands on
        // "defeat" — even before any steal happened this run.
        if (state === 'game-start') {
          this.stolenPokemon = null;
        }
        if (this.currentGameState === 'adventure-continues') {
          if (this.multitaskCounter > 0) {
            this.respinReason = 'Multitask x' + this.multitaskCounter;
            this.multitaskCounter--;
          }
          if (this.bicycleUsed) {
            this.respinReason = 'items.bicycle.name';
          }
        }
      });

    this.gameStateService.currentRoundObserver.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(round => {
      this.leadersDefeatedAmount = round;
    });

    this.generationService.getGeneration().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(generation => {
      this.generation = generation;
    });

    this.gameStateService.wheelSpinningObserver.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => {
      this.wheelSpinning = state;
    });

    // Subscribe to rare candy evolution trigger
    this.rareCandySubscription = this.rareCandyService.rareCandyTrigger$.subscribe((rareCandy) => {
      this.handleRareCandyEvolution(rareCandy);
    });

    this.megaStoneSubscription = this.megaStoneService.megaStoneTrigger$.subscribe((megaStone) => {
      this.handleMegaStoneActivation(megaStone);
    });

    this.typeBiasItemSubscription = this.typeBiasItemService.typeBiasItemTrigger$.subscribe((item) => {
      this.handleTypeBiasItemUse(item);
    });

    this.linkCableSubscription = this.linkCableService.linkCableTrigger$.subscribe((item) => {
      this.handleLinkCable(item);
    });

    this.threatShieldSubscription = this.threatShieldService.threatShieldTrigger$.subscribe((item) => {
      this.handleThreatShieldUse(item);
    });
  }

  ngOnDestroy(): void {
    this.rareCandySubscription?.unsubscribe();
    this.megaStoneSubscription?.unsubscribe();
    this.typeBiasItemSubscription?.unsubscribe();
    this.linkCableSubscription?.unsubscribe();
    this.threatShieldSubscription?.unsubscribe();
  }

  handleRareCandyEvolution(rareCandy: ItemItem): void {
    const pokemonThatCanEvolve = this.trainerService.getPokemonThatCanEvolve();

    if (pokemonThatCanEvolve.length > 0) {
      this.gameStateService.repeatCurrentState();
      this.trainerService.removeItem(rareCandy);
      this.chooseWhoWillEvolve('rare-candy');
    }
  }

  @ViewChild('altPrizeModal', { static: true }) altPrizeModal!: TemplateRef<any>;
  @ViewChild('coinsFoundModal', { static: true }) coinsFoundModal!: TemplateRef<any>;
  /** Coins awarded by the repurposed "found coins" card, shown in coinsFoundModal. */
  coinsFoundAmount = 0;
  @ViewChild('infoModal', { static: true }) infoModal!: TemplateRef<any>;
  @ViewChild('itemActivateModal', { static: true }) itemActivateModal!: TemplateRef<any>;
  @ViewChild('pkmnEvoModal', { static: true }) pkmnEvoModal!: TemplateRef<any>;
  @ViewChild('pkmnTradeModal', { static: true }) pkmnTradeModal!: TemplateRef<any>;
  @ViewChild('teamRocketFailsModal', { static: true }) teamRocketFailsModal!: TemplateRef<any>;

  altPrizeDescription = '';
  altPrizeSprite = '';
  altPrizeText = '';
  auxItemList: ItemItem[] = [];
  auxPokemonList: PokemonItem[] = [];
  /** True only for trade-out: picking which owned Pokémon to offer is a direct pick, not a wheel spin. */
  auxPokemonListPickMode = false;
  /** Original (unweighted) team references behind auxPokemonList's steal-pokemon clones, same order. */
  private stealCandidates: PokemonItem[] = [];
  pokemonForms: PokemonForm[] = [];
  currentContextItem!: ItemItem;
  currentContextPokemon!: PokemonItem;
  currentGameState!: GameState;
  customWheelTitle = '';
  evolutionCredits: number = 0;
  expSharePokemon: PokemonItem | null = null;
  expShareUsed: boolean = false;
  fromLeader: number = 0;
  infoModalMessage = '';
  infoModalTitle = '';
  itemFoundAudio!: SoundFxHandle;
  megaStoneTapAudio!: SoundFxHandle;
  megaEvolutionAudio!: SoundFxHandle;
  leadersDefeatedAmount: number = 0;
  generation!: GenerationItem;

  private readonly gymLeadersByGeneration = gymLeadersByGeneration;
  private readonly eliteFourByGeneration = eliteFourByGeneration;
  private readonly championByGeneration = championByGeneration;
  private readonly opponentPreviewHiddenStates = new Set<GameState>([
    'gym-battle', 'elite-four-battle', 'champion-battle', 'battle-rival'
  ]);
  /**
   * States that show an obtain wheel already-onscreen. A bias item used
   * while one of these is current applies in place via a modal picker
   * (see applyTypeBiasInPlace()) instead of the deferred repeatCurrentState()
   * flow. 'starter-pokemon' is intentionally excluded — the Items panel
   * isn't rendered while it's showing (see MainGameComponent.itemsAvailable),
   * so a bias item can never be clicked during it anyway.
   */
  private readonly obtainWheelStates = new Set<GameState>([
    'catch-pokemon', 'trade-pokemon', 'find-fossil', 'legendary-encounter',
    'catch-cave-pokemon', 'go-fishing', 'mysterious-egg', 'area-zero'
  ]);

  /**
   * Hidden during actual battles (which reveal their own opponent) and before the
   * adventure has started (no roster to plan around yet). 'start-adventure' is
   * pushed exactly once at run setup and never re-pushed, so — same trick as
   * MainGameComponent's itemsAvailable — checking whether it's still sitting
   * unpopped in the stack correctly tells apart the pre-adventure stretch from
   * every later state, reused state names included.
   */
  get showOpponentPreview(): boolean {
    if (!this.generation || this.opponentPreviewHiddenStates.has(this.currentGameState)) {
      return false;
    }
    return !this.gameStateService.getStateStack().includes('start-adventure');
  }

  get previewOpponent(): GymLeader | null {
    if (!this.showOpponentPreview) {
      return null;
    }
    if (this.currentGameState === 'elite-four-preparation') {
      return this.eliteFourByGeneration[this.generation.id]?.[0] ?? null;
    }
    return this.gymLeadersByGeneration[this.generation.id]?.[this.leadersDefeatedAmount] ?? null;
  }

  /**
   * Same visibility window as showOpponentPreview (hidden during battles and
   * before the adventure starts) but also gated on New Experience Mode — the
   * danger meter is a New-Experience-only cadence engine (see
   * DangerMeterService); Classic mode's plain wheel never draws through it.
   */
  get showDangerMeter(): boolean {
    if (!this.gameStateService.isNewExperienceMode || this.opponentPreviewHiddenStates.has(this.currentGameState)) {
      return false;
    }
    return !this.gameStateService.getStateStack().includes('start-adventure');
  }

  multitaskCounter: number = 0;
  pkmnEvoTitle = '';
  pkmnIn!: PokemonItem;
  pkmnOut!: PokemonItem;
  pkmnTradeTitle = '';
  respinReason = '';
  bicycleUsed: boolean = false;
  stolenPokemon!: PokemonItem | null;
  wheelSpinning: boolean = false;
  private megaSelectionMode: 'none' | 'battle-award-pokemon' | 'battle-award-stone' = 'none';
  private pendingMegaAwardPokemon: PokemonItem | null = null;

  getGameState(): string {
    return this.currentGameState;
  }

  private finishCurrentState(): void {

    this.gameStateService.finishCurrentState();

    if (this.currentGameState === 'adventure-continues') {
      if (this.trainerService.hasItem('bicycle') && !this.bicycleUsed) {
        this.bicycleUsed = true;
        this.gameStateService.setNextState('adventure-continues');
        // Same rule as multitask: the bonus step the Bicycle grants is
        // guaranteed threat-free (the danger meter still climbs across it).
        this.dangerMeterService.addGuaranteedRewardSteps(1);
      }
    }

    // gameStateService.finishCurrentState() above synchronously re-enters this
    // component's own gameStateService.currentState subscription (ngOnInit),
    // which can mutate fields like respinReason (e.g. the "Multitask x2" note)
    // that are passed down as an @Input() to whichever roulette is rendered next
    // — chaining multiple actions in a row (e.g. multitask() then doNothing())
    // left that label exactly one action stale, since nothing told Angular's
    // zoneless scheduler that this component had more to re-check. markForCheck()
    // is safe to call repeatedly/from any of this method's many call sites.
    this.cdr.markForCheck();
  }

  handleGenerationSelected(): void {
    this.finishCurrentState();
  }

  handleTrainerSelected(): void {
    this.finishCurrentState();
  }

  capturePokemon(pokemon: PokemonItem): void {
    if (this.currentGameState === 'starter-pokemon') {
      this.statsService.recordRunStart(this.generation.id, pokemon.pokemonId);
    }
    // A pending type bias is single-wheel-use: it already did its job weighting
    // this spin's candidate pool, so it doesn't carry over to the next catch.
    this.trainerService.clearPendingTypeBiases();
    this.preparePokemonCapture(pokemon);
  }

  setShininess(shiny: boolean): void {
    if (shiny) {
      this.trainerService.makeShiny();
      this.registerInPokedex({ ...this.currentContextPokemon, shiny: true });
      this.statsService.recordShiny();
    }
    this.finishCurrentState();
  }

  catchPokemon(): void {
    this.gameStateService.setNextState('catch-pokemon');
    this.finishCurrentState();
  }

  chooseWhoWillEvolve(eventSource: EventSource): void {
    // The "battle trainer" reward card routes straight here; pay its coin bonus
    // once, keyed on the source so the shared rival/gym/team-rocket callers don't.
    if (eventSource === 'battle-trainer') {
      this.awardCardCoins();
    }
    this.auxPokemonList = [];

    this.auxPokemonList = this.trainerService.getPokemonThatCanEvolve();

    if (this.auxPokemonList.length === 0) {
      switch (eventSource) {
        case 'gym-battle':
          this.altPrizeText = 'game.main.altPrizes.gymBattle.potion';
          this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png';
          this.altPrizeDescription = 'game.main.altPrizes.gymBattle.potionDesc';
          this.modalQueueService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          return this.buyPotions();
        case 'visit-daycare':
            this.altPrizeText = 'game.main.altPrizes.visitDaycare.egg';
            this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/items/mystery-egg.png';
            this.altPrizeDescription = 'game.main.altPrizes.visitDaycare.eggDesc';
            this.modalQueueService.open(this.altPrizeModal, {
              centered: true,
              size: 'md'
            });
            return this.mysteriousEgg();
        case 'battle-rival':
          this.altPrizeText = 'game.main.altPrizes.battleRival.item';
          this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/items/unknown.png';
          this.altPrizeDescription = 'game.main.altPrizes.battleRival.itemDesc';
          this.modalQueueService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          return this.findItem();
        case 'battle-trainer':
          this.altPrizeText = 'game.main.altPrizes.battleTrainer.potion';
          this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png';
          this.altPrizeDescription = 'game.main.altPrizes.battleTrainer.potionDesc';
          this.modalQueueService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          return this.buyPotions();
        case 'team-rocket-encounter':
          this.altPrizeText = 'game.main.altPrizes.teamRocket.item';
          this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/items/unknown.png';
          this.altPrizeDescription = 'game.main.altPrizes.teamRocket.itemDesc';
          this.modalQueueService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          return this.findItem();
        case 'snorlax-encounter':
          this.altPrizeText = 'game.main.altPrizes.snorlax.item';
          this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/items/unknown.png';
          this.altPrizeDescription = 'game.main.altPrizes.snorlax.itemDesc';
          this.modalQueueService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          return this.findItem();
        case 'rare-candy':
          return this.doNothing();
        default:
          return this.doNothing();
      }
    }

    if (this.auxPokemonList.length === 1) {
      return this.evolvePokemon(this.auxPokemonList[0]);
    }

    this.customWheelTitle = 'game.main.roulette.evolve.who';
    this.auxPokemonListPickMode = false;
    this.gameStateService.setNextState('evolve-pokemon');
    this.gameStateService.setNextState('select-from-pokemon-list');

    this.finishCurrentState();
  }

  buyPotions(): void {
    // New Experience repurposes this card as a "found coins" bundle now that a
    // real Market exists (see economy-and-market plan). Classic mode keeps the
    // original free-potion behaviour — it has no coins to award.
    if (this.gameStateService.isNewExperienceMode) {
      this.coinsFoundAmount = foundCoinsReward();
      this.trainerService.addCoins(this.coinsFoundAmount);
      this.playItemFoundAudio();
      this.modalQueueService.open(this.coinsFoundModal, { centered: true, size: 'md' });
      this.finishCurrentState();
      return;
    }

    let itemName: ItemName = 'potion';

    if (this.leadersDefeatedAmount > 6) {
      itemName = 'hyper-potion';
    } else if (this.leadersDefeatedAmount > 3) {
      itemName = 'super-potion';
    }

    this.trainerService.addToItems(this.itemService.getItem(itemName));
    this.playItemFoundAudio();
    this.finishCurrentState();
  }

  doNothing(): void {
    this.finishCurrentState();
  }

  /**
   * Coins for winning a battle (New Experience only). Call BEFORE advanceRound so
   * `leadersDefeatedAmount` is still the round just cleared. `advancesRound` adds
   * the flat per-round stipend — passed true only for gym/elite four (which
   * advance the round), so the stipend lands exactly once per round and can't be
   * farmed by rival wins or `multitask`. Champion wins skip this entirely: the run
   * ends, so there is nothing left to spend on.
   */
  private awardBattleCoins(advancesRound: boolean): void {
    if (!this.gameStateService.isNewExperienceMode) {
      return;
    }
    let coins = battleWinReward(this.leadersDefeatedAmount);
    if (advancesRound) {
      coins += PASSIVE_PER_ROUND;
    }
    this.trainerService.addCoins(coins);
  }

  /** A reward card's coin bonus (New Experience only). */
  private awardCardCoins(): void {
    if (!this.gameStateService.isNewExperienceMode) {
      return;
    }
    this.trainerService.addCoins(cardCoinReward());
  }

  mysteriousEgg(): void {
    this.gameStateService.setNextState('mysterious-egg');
    this.finishCurrentState();
  }

  findItem(): void {
    this.gameStateService.setNextState('find-item');
    this.finishCurrentState();
  }

  findAbilityCapsule(): void {
    this.gameStateService.setNextState('find-ability-capsule');
    this.finishCurrentState();
  }

  continueWithPokemon(pokemon: PokemonItem): void {
    this.finishCurrentState();

    if (this.handleMegaSelection(pokemon)) {
      return;
    }

    switch (this.currentGameState) {
      case 'evolve-pokemon':
        this.evolvePokemon(pokemon);
        break;
      case 'select-evolution':
        this.replaceForEvolution(this.currentContextPokemon, pokemon);
        this.showpkmnEvoModal();
        break;
      case 'steal-pokemon': {
        // auxPokemonList holds power-weighted clones (see weightByInversePower), not the
        // real team objects — resolve back to the original by shared position so
        // TrainerService.removeFromTeam's reference-based indexOf still finds it.
        const index = this.auxPokemonList.indexOf(pokemon);
        const original = index !== -1 ? this.stealCandidates[index] : pokemon;
        this.stolenPokemon = original;
        this.statsService.recordStealSuffered();
        this.removeFromTeam(original);
        this.finishCurrentState();
        break;
      }
      case 'forced-retreat-pokemon': {
        // Same weak-biased pick as steal-pokemon, but Forced Retreat benches
        // the Pokémon to PC storage (locked for 1 combat round) instead of
        // removing it outright — reversible only after surviving one more fight.
        const index = this.auxPokemonList.indexOf(pokemon);
        const original = index !== -1 ? this.stealCandidates[index] : pokemon;
        original.retreatLocked = true;
        const newTeam = this.trainerService.getTeam().filter(p => p !== original);
        const newStorage = [...this.trainerService.getStored(), original];
        this.trainerService.commitTeamAndStorage(newTeam, newStorage);
        this.finishCurrentState();
        break;
      }
      case 'trade-pokemon':
        this.currentContextPokemon = pokemon;
        break;
      default:
        break;
    }
  }

  continueWithItem(item: ItemItem): void {
    this.finishCurrentState();

    if (this.handleMegaStoneAwardSelection(item)) {
      return;
    }
  }

  selectPokemonForm(pokemonForm: PokemonForm): void {
    this.currentContextPokemon = this.pokemonFormsService.applyFormToPokemon(this.currentContextPokemon, pokemonForm);
    this.completePokemonCapture(this.currentContextPokemon);
  }

  secondEvolution(): void {
    this.auxPokemonList = [];

    this.auxPokemonList = this.trainerService.getPokemonThatCanEvolve();

    if (this.expSharePokemon) {
      const index = this.auxPokemonList.indexOf(this.expSharePokemon);
      if (index > -1) {
        this.auxPokemonList.splice(index, 1);
      }
    }

    if (this.auxPokemonList.length === 0) {
      return;
    }

    if (this.auxPokemonList.length === 1) {
      return this.evolveSecondPokemon(this.auxPokemonList[0]);
    }

    this.customWheelTitle = 'game.main.roulette.evolve.whoExpShare';
    this.auxPokemonListPickMode = false;
    this.gameStateService.setNextState('evolve-pokemon');
    this.gameStateService.setNextState('select-from-pokemon-list');
  }

  gymBattleResult(result: boolean): void {
    this.bicycleUsed = false;
    this.respinReason = '';

    if (result) {
      this.statsService.recordBattleWin('gym');
      this.playItemFoundAudio();
      this.trainerService.addBadge(this.leadersDefeatedAmount, this.fromLeader);
      this.awardBattleCoins(true);
      this.gameStateService.advanceRound();
      this.queueCheckEvolutionAfterImportantBattle();
      this.awardMegaStoneAfterImportantBattle();
      this.finishCurrentState();

    } else {
      this.statsService.recordBattleLoss('gym', this.opponentNemesisKey('gym'));
      this.statsService.recordRunEnd(false, this.leadersDefeatedAmount);
      this.gameStateService.setNextState('game-over');
      this.finishCurrentState();
    }
  }

  /** Stable key for "which opponent ended a run" — see StatsService.recordBattleLoss. */
  private opponentNemesisKey(battleType: 'gym' | 'eliteFour' | 'champion'): string {
    let name: string | undefined;
    if (battleType === 'gym') {
      name = this.gymLeadersByGeneration[this.generation.id]?.[this.leadersDefeatedAmount]?.name;
    } else if (battleType === 'eliteFour') {
      name = this.eliteFourByGeneration[this.generation.id]?.[this.leadersDefeatedAmount % 4]?.name;
    } else {
      name = this.championByGeneration[this.generation.id]?.[0]?.name;
    }
    return `${battleType}:${name ?? 'unknown'}`;
  }

  catchTwoPokemon(): void {
    this.gameStateService.setNextState('catch-pokemon');
    this.gameStateService.setNextState('catch-pokemon');
    this.finishCurrentState();
  }

  catchThreePokemon(): void {
    this.gameStateService.setNextState('catch-pokemon');
    this.gameStateService.setNextState('catch-pokemon');
    this.gameStateService.setNextState('catch-pokemon');
    this.finishCurrentState();
  }

  teamRocketEncounter(): void {
    this.gameStateService.setNextState('team-rocket-encounter');
    this.finishCurrentState();
  }

  /** V2 "teamRocketAmbush" threat (New Experience only): same mini-wheel as the reward-pool Team Rocket encounter, with a threat-specific modal explaining the ambush first. */
  teamRocketAmbush(): void {
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.teamRocketAmbush.title');
    this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.teamRocketAmbush.description');
    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.teamRocketEncounter();
  }

  legendaryEncounter(): void {
    this.gameStateService.setNextState('legendary-encounter');
    this.finishCurrentState();
  }

  tradePokemon(): void {
    this.gameStateService.setNextState('trade-pokemon');

    const trainerTeam = this.trainerService.getTeam();

    if (trainerTeam.length === 1) {
      this.currentContextPokemon = trainerTeam[0];
    } else {
      this.auxPokemonList = trainerTeam;
      this.customWheelTitle = 'game.main.roulette.trade.which';
      this.auxPokemonListPickMode = true;
      this.gameStateService.setNextState('select-from-pokemon-list');
    }

    this.finishCurrentState();
  }

  /**
   * Honey/Poké Radar/Repel/Max Repel. If an obtain wheel is already on
   * screen, apply the bias in place via a modal picker (no GameState
   * change) so the player never leaves the wheel they're looking at.
   * Otherwise, defer to whichever wheel comes next: repeatCurrentState()
   * re-queues the screen the player was already on, so picking a type is a
   * bonus action, not a substitute for their normal turn.
   */
  private handleTypeBiasItemUse(item: ItemItem): void {
    if (this.obtainWheelStates.has(this.currentGameState)) {
      this.applyTypeBiasInPlace(item);
      return;
    }

    this.gameStateService.repeatCurrentState();
    this.trainerService.removeItem(item);
    this.pendingTypeBiasItem = item;
    this.gameStateService.setNextState('select-from-type-list');
    this.finishCurrentState();
  }

  /**
   * Applies a bias item to the obtain wheel already on screen via a modal
   * type-picker overlay. Removing the item and calling applyBiasForItem()
   * updates TrainerService, which every obtain-wheel component is
   * subscribed to — they recompute and reassign their candidate pool, which
   * makes the wheel underneath redraw live (WheelComponent.ngOnChanges).
   */
  private async applyTypeBiasInPlace(item: ItemItem): Promise<void> {
    const modalRef = await this.modalQueueService.open(SelectFromTypeListRouletteComponent, {
      centered: true,
      backdrop: 'static'
    });

    modalRef.componentInstance.maxSelections = item.name === 'honey' ? HONEY_MAX_TYPES : 1;
    modalRef.componentInstance.screenTitle = this.typeBiasScreenTitleFor(item);

    const subscription = modalRef.componentInstance.selectedTypesEvent.subscribe((types: PokemonType[]) => {
      this.trainerService.removeItem(item);
      this.applyBiasForItem(item, types);
      modalRef.close();
    });

    modalRef.result.finally(() => subscription.unsubscribe());
  }

  getTypeIconUrl(type: PokemonType): string {
    return getTypeIconUrl(type);
  }

  /** Honey allows up to 3 types (see HONEY_MAX_TYPES); Poké Radar/Max Repel stay single-pick. */
  get honeyPendingMaxSelections(): number {
    return this.pendingTypeBiasItem?.name === 'honey' ? HONEY_MAX_TYPES : 1;
  }

  get pendingTypeBiasScreenTitle(): string {
    return this.pendingTypeBiasItem ? this.typeBiasScreenTitleFor(this.pendingTypeBiasItem) : 'game.main.roulette.typeBias.which';
  }

  private typeBiasScreenTitleFor(item: ItemItem): string {
    return item.name === 'honey' ? 'game.main.roulette.typeBias.whichHoney' : 'game.main.roulette.typeBias.which';
  }

  continueWithType(types: PokemonType[]): void {
    this.finishCurrentState();

    const item = this.pendingTypeBiasItem;
    this.pendingTypeBiasItem = null;
    if (!item) {
      return;
    }

    this.applyBiasForItem(item, types);
  }

  /**
   * Honey boosts TOWARD up to 3 chosen types (target-share, see TrainerService.addHoneyUse);
   * Poké Radar boosts TOWARD a single type (hard filter). Each use appends an entry rather
   * than overwriting, so repeated uses stack instead of replacing each other.
   */
  private applyBiasForItem(item: ItemItem, types: PokemonType[]): void {
    if (item.name === 'honey') {
      this.trainerService.addHoneyUse(types);
      return;
    }
    this.trainerService.setTowardBias({ type: types[0], mode: 'hard' });
  }

  /**
   * Repel/Max Repel: a bonus action, not a substitute for the player's normal
   * turn — no repeatCurrentState(), it just mutates the danger meter and lets
   * play continue. NE-only safety net in case the item somehow surfaces in
   * Classic (getRegularItems() already filters it out there).
   */
  private handleThreatShieldUse(item: ItemItem): void {
    if (!this.gameStateService.isNewExperienceMode) {
      return;
    }
    const count = item.name === 'max-repel' ? 3 : 1;
    this.dangerMeterService.addThreatShield(count);
    this.trainerService.removeItem(item);
  }

  /**
   * Link Cable: trigger a trade encounter on demand instead of waiting for the
   * adventure wheel to offer one. repeatCurrentState() first, for the same
   * reason as handleTypeBiasItemUse — this is a bonus action.
   */
  private handleLinkCable(item: ItemItem): void {
    this.gameStateService.repeatCurrentState();
    this.trainerService.removeItem(item);
    this.tradePokemon();
  }

  exploreCave(): void {
    this.awardCardCoins();
    this.gameStateService.setNextState('explore-cave');
    this.finishCurrentState();
  }

  snorlaxEncounter(): void {
    this.awardCardCoins();
    this.gameStateService.setNextState('snorlax-encounter');
    this.finishCurrentState();
  }

  multitask(): void {
    this.gameStateService.setNextState('adventure-continues');
    this.gameStateService.setNextState('adventure-continues');
    this.multitaskCounter = this.multitaskCounter + 2;
    this.respinReason = 'Multitask x' + this.multitaskCounter;
    // The extra picks multitask hands out are guaranteed threat-free (New
    // Experience mode) — a reward that grants more rewards shouldn't be able to
    // ambush you. The danger meter still climbs across them. No-op in Classic
    // mode, where nothing draws through the danger meter.
    this.dangerMeterService.addGuaranteedRewardSteps(2);
    this.finishCurrentState();
  }

  goFishing(): void {
    this.awardCardCoins();
    this.gameStateService.setNextState('go-fishing');
    this.finishCurrentState();
  }

  findFossil(): void {
    this.awardCardCoins();
    this.gameStateService.setNextState('find-fossil');
    this.finishCurrentState();
  }

  areaZero(): void {
    this.gameStateService.setNextState('area-zero');
    this.finishCurrentState();
  }

  /** V2 "itemTheft" threat (New Experience only): removes one random item, or nothing if the inventory is empty. */
  itemTheft(): void {
    const items = this.trainerService.getItems();
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.itemTheft.title');

    if (items.length === 0) {
      this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.itemTheft.nothingFound');
    } else {
      const stolenItem = items[Math.floor(Math.random() * items.length)];
      this.trainerService.removeItem(stolenItem);
      const itemName = this.translateService.instant(stolenItem.text);
      this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.itemTheft.stolenItem') + itemName;
    }

    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.doNothing();
  }

  /** V2 "markedTarget" threat (New Experience only): one random team Pokémon is forced to lead the next real battle. */
  markedTarget(): void {
    const team = this.trainerService.getTeam();
    if (team.length < 2) {
      // Forcing the only option would be a no-op — skip.
      this.doNothing();
      return;
    }
    const index = Math.floor(Math.random() * team.length);
    this.markedTargetService.setMark(index);
    const pokemonName = this.translateService.instant(team[index].text);
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.markedTarget.title');
    this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.markedTarget.description') + pokemonName;
    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.doNothing();
  }

  /** V2 "pokeballMalfunction" threat (New Experience only): the next catch attempt has a chance to fail. */
  pokeballMalfunction(): void {
    this.catchRiskService.setEscapeChance(MALFUNCTION_ESCAPE_CHANCE);
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.pokeballMalfunction.title');
    this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.pokeballMalfunction.description');
    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.doNothing();
  }

  /**
   * V2 threat-draw filter (New Experience only): threat ids that would be a
   * costless no-op given current roster state, excluded from the draw pool
   * before a threat step commits its danger-meter relief (see
   * `MainAdventureRouletteComponent.initializeDraw()`).
   */
  excludedThreatIds(): string[] {
    const teamCount = this.trainerService.getTeam().length;
    const total = teamCount + this.trainerService.getStored().length;
    const excluded: string[] = [];
    if (total <= 1) excluded.push('pcLockout'); // nothing to withdraw or bench
    if (teamCount <= 1) excluded.push('forcedRetreat', 'markedTarget'); // never bench/mark your only battler
    return excluded;
  }

  /**
   * V2 "forcedRetreat" threat (New Experience only): benches a weak-biased
   * team Pokémon to PC storage, locked there for 1 combat round (see the
   * 'forced-retreat-pokemon' case in continueWithPokemon()).
   */
  forcedRetreat(): void {
    const trainerTeam = this.trainerService.getTeam();
    if (trainerTeam.length < 2) {
      // Never bench the player's only Pokémon.
      this.doNothing();
      return;
    }
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.forcedRetreat.title');
    this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.forcedRetreat.description');
    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.stealCandidates = trainerTeam;
    this.auxPokemonList = this.weightByInversePower(trainerTeam);
    this.customWheelTitle = 'game.main.roulette.adventure.threats.forcedRetreat.pickPokemon';
    this.auxPokemonListPickMode = false;
    this.gameStateService.setNextState('forced-retreat-pokemon');
    this.gameStateService.setNextState('select-from-pokemon-list');
    this.finishCurrentState();
  }

  /** V2 "badOmen" threat (New Experience only): extra No tickets on the next battle, persisted so a reload can't shake it off. */
  badOmen(): void {
    this.battleDebuffService.setDebuff(BADOMEN_DEBUFF_AMOUNT);
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.badOmen.title');
    this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.badOmen.description');
    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.doNothing();
  }

  /** V2 "spooked" threat (New Experience only): spikes the Danger meter back up. */
  spooked(): void {
    this.dangerMeterService.applySpike();
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.spooked.title');
    this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.spooked.description');
    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.doNothing();
  }

  /**
   * V2 "scoutingReport" threat (New Experience only): the next real battle's opponent gains
   * one extra type, super-effective against the strongest Pokémon across team + PC (locked
   * at draw time so stashing the ace afterward can't relabel who's targeted — see the
   * "Scouting 'strongest'" decision in docs/plans/threat-mechanics-expansion.md). Pure random
   * pick among the counters, not "meanest."
   */
  scoutingReport(): void {
    const roster = [...this.trainerService.getTeam(), ...this.trainerService.getStored()];
    if (roster.length === 0) {
      this.doNothing();
      return;
    }
    const ace = roster.reduce((best, p) => (p.power > best.power ? p : best), roster[0]);
    const aceTypes = [ace.type1, ace.type2].filter((t): t is PokemonType => !!t);
    const shuffledAceTypes = [...aceTypes].sort(() => Math.random() - 0.5);
    let chosen: PokemonType | null = null;
    for (const at of shuffledAceTypes) {
      const counters = this.typeMatchupService.getSuperEffectiveCounters(at);
      if (counters.length) {
        chosen = counters[Math.floor(Math.random() * counters.length)];
        break;
      }
    }
    if (!chosen) {
      // No type on the ace has any counter — extremely rare (no type is currently
      // counter-less in this game's chart), but guard against a costless no-op regardless.
      this.doNothing();
      return;
    }
    this.scoutingReportService.setType(chosen);
    const aceName = this.translateService.instant(ace.text);
    const typeName = this.translateService.instant(`pokemonType.${chosen}`);
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.scoutingReport.title');
    this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.scoutingReport.description', { pokemon: aceName, type: typeName });
    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.doNothing();
  }

  /**
   * V2 "pcLockout" threat (New Experience only): freezes the PC both directions (no withdraw,
   * no deposit) until the next real battle resolves. The `total <= 1` guard is a defensive
   * fallback — Phase 1's draw-filter (`excludedThreatIds`) already excludes this threat in
   * that case, so it should never actually fire here in normal play.
   */
  pcLockout(): void {
    const total = this.trainerService.getTeam().length + this.trainerService.getStored().length;
    if (total <= 1) {
      this.doNothing();
      return;
    }
    this.pcLockService.setLock(true);
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.pcLockout.title');
    this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.pcLockout.description');
    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.doNothing();
  }

  private tollAmount(round: number): number {
    return 15 + 3 * round;
  }

  /**
   * V2 "tollBooth" threat (New Experience only): drains coins scaled by round. An empty or
   * short wallet takes what's there and applies a danger-meter spike scaled to the unpaid
   * fraction of the toll — being short must never be a costless no-op (see the threat design
   * guardrail in docs/plans/threat-mechanics-expansion.md).
   */
  tollBooth(): void {
    const round = this.gameStateService.currentRoundValue;
    const toll = this.tollAmount(round);
    const balance = this.trainerService.getCoins();
    const paid = Math.min(balance, toll);
    if (paid > 0) {
      this.trainerService.spendCoins(paid);
    }
    const unpaidFraction = (toll - paid) / toll;
    let spike = 0;
    if (unpaidFraction > 0) {
      spike = unpaidFraction <= 1 / 3 ? 2 : unpaidFraction <= 2 / 3 ? 3 : 5;
      this.dangerMeterService.applySpike(spike);
    }
    this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.tollBooth.title');
    this.infoModalMessage = spike > 0
      ? this.translateService.instant('game.main.roulette.adventure.threats.tollBooth.shortMessage', { paid, spike })
      : this.translateService.instant('game.main.roulette.adventure.threats.tollBooth.paidMessage', { paid });
    this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
    this.doNothing();
  }

  paradoxCaptureChance(pokemon: PokemonItem): void {
    this.currentContextPokemon = structuredClone(pokemon);
    // Single-wheel-use: the bias already weighted this Area Zero spin.
    this.trainerService.clearPendingTypeBiases();
    this.gameStateService.setNextState('catch-paradox');
    this.finishCurrentState();
  }

  paradoxCaptureSuccess(): void {
    this.statsService.recordLegendaryCaught();
    this.preparePokemonCapture(this.currentContextPokemon);
  }

  battleRival(): void {
    this.gameStateService.setNextState('battle-rival');
    this.finishCurrentState();
  }

  rivalBattleResult(result: boolean): void {
    if (result) {
      this.statsService.recordBattleWin('rival');
      this.awardBattleCoins(false);
      this.chooseWhoWillEvolve('battle-rival');
    } else {
      // A rival loss never ends the run on its own — it faints the lead
      // instead (New Experience only, see RivalBattleRouletteComponent). It's
      // never a "nemesis" — omit the opponent key.
      this.statsService.recordBattleLoss('rival');
      // Edge case: the faint above emptied the team (no Pokémon left to
      // field). Nothing to continue with — end the run like any other loss.
      if (this.gameStateService.isNewExperienceMode && this.trainerService.getTeam().length === 0) {
        this.statsService.recordRunEnd(false, this.leadersDefeatedAmount);
        this.gameStateService.setNextState('game-over');
      }
      this.doNothing();
    }
  }

  stealPokemon(): void {
    const trainerTeam = this.trainerService.getTeam();

    if (trainerTeam.length < 2) {
      this.modalQueueService.open(this.teamRocketFailsModal, {
        centered: true,
        size: 'md'
      }).then(modalRef => {
        const onDone = () => this.doNothing();
        modalRef.result.then(onDone, onDone);
      });
    } else if (this.trainerService.hasItem('escape-rope')) {
      this.useEscapeRope();
    } else {
      this.stealCandidates = trainerTeam;
      this.auxPokemonList = this.weightByInversePower(trainerTeam);
      this.customWheelTitle = 'game.main.roulette.teamrocket.steal.which';
      this.auxPokemonListPickMode = false;
      this.gameStateService.setNextState('steal-pokemon');
      this.gameStateService.setNextState('select-from-pokemon-list');
      this.finishCurrentState();
    }
  }

  /**
   * A stronger Pokémon puts up more of a fight, so it's harder for Team Rocket
   * to steal — clones with an adjusted weight rather than mutating the real
   * team objects, since .weight is read by every other wheel too.
   * Deliberately bias-independent: 'select-from-pokemon-list' is not in
   * obtainWheelStates, so a pending type bias never touches this weighting —
   * don't wire one in here.
   */
  private weightByInversePower(pokemon: PokemonItem[]): PokemonItem[] {
    return pokemon.map(p => ({ ...p, weight: 1 / p.power }));
  }

  teamRocketDefeated(): void {
    if (this.stolenPokemon) {
      const pokemonName = this.translateService.instant(this.stolenPokemon.text);

      this.trainerService.addToTeam(this.stolenPokemon);
      this.registerInPokedex(this.stolenPokemon);
      this.infoModalTitle = this.translateService.instant('game.main.roulette.teamrocket.saved.title') + pokemonName + '!';
      this.infoModalMessage = this.translateService.instant('game.main.roulette.teamrocket.saved.recovered') + pokemonName + ' ' + this.translateService.instant('game.main.roulette.teamrocket.saved.from');
      this.stolenPokemon = null;
      this.modalQueueService.open(this.infoModal, {
        centered: true,
        size: 'md'
      });
    }

    this.chooseWhoWillEvolve('team-rocket-encounter');
  }

  legendaryCaptureChance(pokemon: PokemonItem): void {
    this.currentContextPokemon = structuredClone(pokemon);
    // Single-wheel-use: the bias already weighted this legendary spin.
    this.trainerService.clearPendingTypeBiases();
    this.gameStateService.setNextState('catch-legendary');
    this.finishCurrentState();
  }
  
  legendaryCaptureSuccess(): void {
    this.statsService.recordLegendaryCaught();
    this.preparePokemonCapture(this.currentContextPokemon);
  }

  performTrade(pokemon: PokemonItem): void {
    this.pkmnIn = structuredClone(pokemon);
    this.pkmnOut = this.currentContextPokemon;
    this.pkmnTradeTitle = "game.main.trade.title";
    // Single-wheel-use: the bias already weighted this trade spin.
    this.trainerService.clearPendingTypeBiases();
    this.trainerService.performTrade(this.currentContextPokemon, this.pkmnIn);
    this.registerInPokedex(this.pkmnIn);
    this.auxPokemonList = [];
    this.playItemFoundAudio();
    if (!this.settingsService.currentSettings.lessExplanations) {
      this.modalQueueService.open(this.pkmnTradeModal, {
        centered: true,
        size: 'md'
      }).then(modalRef => {
        const onDone = () => this.finishCurrentState();
        modalRef.result.then(onDone, onDone);
      });
    } else {
      this.finishCurrentState();
    }
  }

  receiveItem(item: ItemItem): void {
    this.trainerService.addToItems(item);
    this.finishCurrentState();
  }

  catchCavePokemon(): void {
    this.gameStateService.setNextState('catch-cave-pokemon');
    this.finishCurrentState();
  }

  getLost(): void {
    if (this.trainerService.hasItem('escape-rope')) {
      this.useEscapeRope();
    } else {
      return this.doNothing();
    }
  }

  catchZubat(): void {
    const zubat = this.pokemonService.getPokemonById(41);
    if (zubat) {
      this.preparePokemonCapture(zubat);
      return;
    }
    this.finishCurrentState();
  }

  catchSnorlax(): void {
    const snorlax = this.pokemonService.getPokemonById(143);
    if (snorlax) {
      this.preparePokemonCapture(snorlax);
      return;
    }
    this.finishCurrentState();
  }

  eliteFourBattleResult(result: boolean): void {
    this.bicycleUsed = false;
    this.respinReason = '';

    if (result) {
      this.statsService.recordBattleWin('eliteFour');
      this.awardBattleCoins(true);
      this.gameStateService.advanceRound();
      this.queueCheckEvolutionAfterImportantBattle();
      this.awardMegaStoneAfterImportantBattle();
      this.finishCurrentState();
    } else {
      this.statsService.recordBattleLoss('eliteFour', this.opponentNemesisKey('eliteFour'));
      this.statsService.recordRunEnd(false, this.leadersDefeatedAmount);
      this.gameStateService.setNextState('game-over');
      this.finishCurrentState();
    }
  }

  championBattleResult(result: boolean): void {
    this.bicycleUsed = false;
    this.respinReason = '';

    if (result) {
      const rawIds = [
        ...this.trainerService.getTeam().map(p => p.pokemonId),
        ...this.trainerService.getStored().map(p => p.pokemonId)
      ];
      const wonIds = [...new Set(rawIds.flatMap(id => {
        const baseId = this.pokemonFormsService.getBasePokemonId(id);
        return baseId !== null && baseId !== id ? [id, baseId] : [id];
      }))];
      this.pokedexService.markWon(wonIds);
      this.statsService.recordBattleWin('champion', this.generation.id);
      this.gameStateService.advanceRound();
      this.statsService.recordRunEnd(true, this.leadersDefeatedAmount);
      this.finishCurrentState();
    } else {
      this.statsService.recordBattleLoss('champion', this.opponentNemesisKey('champion'));
      this.statsService.recordRunEnd(false, this.leadersDefeatedAmount);
      this.gameStateService.setNextState('game-over');
      this.finishCurrentState();
    }
  }

  private queueCheckEvolutionAfterImportantBattle(): void {
    this.gameStateService.setNextState('check-evolution');
  }

  private getMegaCandidates(): PokemonItem[] {
    return this.trainerService.getMegaStoneEligiblePokemon();
  }

  private awardMegaStoneAfterImportantBattle(): void {
    const candidates = this.getMegaCandidates();

    if (candidates.length === 0) {
      return;
    }

    if (candidates.length === 1) {
      this.startMegaStoneAward(candidates[0]);
      return;
    }

    this.megaSelectionMode = 'battle-award-pokemon';
    this.auxPokemonList = candidates;
    this.customWheelTitle = 'game.main.roulette.mega.who';
    this.auxPokemonListPickMode = false;
    this.gameStateService.setNextState('select-from-pokemon-list');
  }

  private startMegaStoneAward(pokemon: PokemonItem): void {
    const availableStoneNames = this.trainerService.getAvailableMegaStoneNamesForPokemon(pokemon);

    if (availableStoneNames.length === 0) {
      return;
    }

    if (availableStoneNames.length === 1) {
      this.grantMegaStone(pokemon, availableStoneNames[0]);
      return;
    }

    this.pendingMegaAwardPokemon = pokemon;
    this.auxItemList = availableStoneNames.map(stoneName => structuredClone(this.itemService.getMegaStone(stoneName)));
    this.customWheelTitle = 'game.main.roulette.mega.whichStone';
    this.megaSelectionMode = 'battle-award-stone';
    this.gameStateService.setNextState('select-from-item-list');
  }

  private grantMegaStone(pokemon: PokemonItem, stoneName: MegaStoneItemName): void {
    if (!this.trainerService.hasItem(stoneName)) {
      const megaStone = structuredClone(this.itemService.getMegaStone(stoneName));
      this.trainerService.addToItems(megaStone);
      this.playItemFoundAudio();
      this.altPrizeText = 'game.main.altPrizes.megaStone.stone';
      this.altPrizeSprite = megaStone.sprite;
      this.altPrizeDescription = 'game.main.altPrizes.megaStone.stoneDesc';
      this.modalQueueService.open(this.altPrizeModal, {
        centered: true,
        size: 'md'
      });
    } else {
      // No stone to award (already held or undefined)
    }
  }

  private handleMegaSelection(pokemon: PokemonItem): boolean {
    if (this.megaSelectionMode === 'none') {
      return false;
    }

    const selectionMode = this.megaSelectionMode;

    if (selectionMode === 'battle-award-pokemon') {
      this.megaSelectionMode = 'none';
      this.startMegaStoneAward(pokemon);
      return true;
    }

    return false;
  }

  private handleMegaStoneAwardSelection(item: ItemItem): boolean {
    if (this.megaSelectionMode !== 'battle-award-stone') {
      return false;
    }

    const pokemon = this.pendingMegaAwardPokemon;
    this.pendingMegaAwardPokemon = null;
    this.auxItemList = [];
    this.megaSelectionMode = 'none';

    if (!pokemon || !isMegaStoneItemName(item.name)) {
      return true;
    }

    this.grantMegaStone(pokemon, item.name);
    return true;
  }

  private handleMegaStoneActivation(megaStone: ItemItem): void {
    if (!this.isBattleState(this.currentGameState)) {
      return;
    }

    // Defensive guard: if a mega form is already active on team, ignore further triggers.
    if (this.trainerService.hasActiveMegaFormInTeam()) {
      return;
    }

    // One mega use per battle: after first activation, further attempts are ignored
    // until battle exit reverts forms and clears the selected mega base id.
    if (this.trainerService.getMegaBattleBaseId() !== null) {
      return;
    }

    if (!isMegaStoneItemName(megaStone.name)) {
      return;
    }

    const matchingPokemon = this.getPokemonMatchingMegaStone(megaStone.name);
    if (matchingPokemon.length === 0) {
      return;
    }

    if (this.settingsService.currentSettings.skipMegaEvolutionAnimation) {
      void this.soundFxService.playSoundFx(this.megaStoneTapAudio, 0.30);
    } else {
      // Play mega sounds sequentially (tap -> evolution) via audio-ended queue.
      void this.soundFxService.playSoundFxQueue([
        { handle: this.megaStoneTapAudio, volume: 0.30 },
        { handle: this.megaEvolutionAudio, volume: 0.30 }
      ]);
    }

    this.activateMegaEvolutionForPokemon(matchingPokemon[0].pokemonId, megaStone.name);
  }

  private getPokemonMatchingMegaStone(stoneName: MegaStoneItemName): PokemonItem[] {
    const seen = new Set<number>();
    const matching: PokemonItem[] = [];

    for (const pokemon of this.trainerService.getTeam()) {
      if (!megaStoneNamesForBaseId(pokemon.pokemonId).includes(stoneName)) {
        continue;
      }
      if (seen.has(pokemon.pokemonId)) {
        continue;
      }
      seen.add(pokemon.pokemonId);
      matching.push(pokemon);
    }

    return matching;
  }

  private activateMegaEvolutionForPokemon(basePokemonId: number, stoneName?: MegaStoneItemName): void {
    this.trainerService.setMegaBattlePokemon(basePokemonId, stoneName ?? null);
    this.trainerService.forceMegaActivation(basePokemonId, stoneName);
    this.pokedexService.markMega(basePokemonId);
    void this.showMegaEvolutionAnimation(basePokemonId, stoneName);
  }

  private resolveMegaEvolutionPokemonId(basePokemonId: number, stoneName?: MegaStoneItemName): number {
    const megaForms = pokemonMegaForms[basePokemonId] ?? [];

    if (megaForms.length === 0) {
      return basePokemonId;
    }

    if (!stoneName) {
      return megaForms[0].pokemonId;
    }

    const stoneNames = megaStoneNamesForBaseId(basePokemonId);
    const stoneIndex = stoneNames.indexOf(stoneName);

    if (stoneIndex < 0 || !megaForms[stoneIndex]) {
      return megaForms[0].pokemonId;
    }

    return megaForms[stoneIndex].pokemonId;
  }

  private async showMegaEvolutionAnimation(basePokemonId: number, stoneName?: MegaStoneItemName): Promise<void> {
    if (this.settingsService.currentSettings.skipMegaEvolutionAnimation) {
      return;
    }

    const megaPokemonId = this.resolveMegaEvolutionPokemonId(basePokemonId, stoneName);
    const animRef = await this.modalQueueService.open(MegaEvolutionAnimationModalComponent, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });
    animRef.componentInstance.pokemonId = basePokemonId;
    animRef.componentInstance.megaPokemonId = megaPokemonId;
  }

  private isBattleState(state: GameState): boolean {
    return state === 'gym-battle' || state === 'elite-four-battle' || state === 'champion-battle';
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  resetGameAction(): void {
    this.evolutionCredits = 0;
    this.resetGameEvent.emit();
    this.modalService.dismissAll();
  }

  private evolvePokemon(pokemon: PokemonItem): void {
    const pokemonEvolutions = this.evolutionService.getEvolutions(pokemon);

    if (pokemonEvolutions.length === 1) {
      this.replaceForEvolution(pokemon, pokemonEvolutions[0]);
      this.showpkmnEvoModal();
    } else {
      this.auxPokemonList = pokemonEvolutions;
      this.currentContextPokemon = pokemon;
      this.customWheelTitle = 'game.main.roulette.evolve.which';
      this.auxPokemonListPickMode = false;
      this.gameStateService.setNextState('select-evolution');
      this.gameStateService.setNextState('select-from-pokemon-list');
      this.finishCurrentState();
    }
  }

  private preparePokemonCapture(pokemon: PokemonItem): void {
    const escapeChance = this.catchRiskService.currentEscapeChance;
    if (escapeChance > 0) {
      this.catchRiskService.clearEscapeChance();
      if (Math.random() < escapeChance) {
        const pokemonName = this.translateService.instant(pokemon.text);
        this.infoModalTitle = this.translateService.instant('game.main.roulette.adventure.threats.pokeballMalfunction.escapeTitle');
        this.infoModalMessage = this.translateService.instant('game.main.roulette.adventure.threats.pokeballMalfunction.escapeMessage') + pokemonName;
        this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
        this.finishCurrentState();
        return;
      }
    }

    if (this.pokemonFormsService.hasForms(pokemon)) {
      const pokemonForms = this.pokemonFormsService.getPokemonForms(pokemon);
      
      if (pokemonForms.length > 1) {
        this.currentContextPokemon = structuredClone(pokemon);
        this.pokemonForms = pokemonForms;
        this.gameStateService.setNextState('select-form');
        this.finishCurrentState();
        return;
      }
      
    }
    this.completePokemonCapture(pokemon);
    return;
  }

  private completePokemonCapture(pokemon: PokemonItem): void {
    this.currentContextPokemon = pokemon; // ensures setShininess can reference captured pokemon
    this.trainerService.addToTeam(pokemon);
    this.registerInPokedex(pokemon);
    this.statsService.recordCapture();

    if (this.settingsService.currentSettings.skipShinyRolls) {
      const isShiny = Math.random() < (1 / 64);
      this.setShininess(isShiny);
      return;
    }

    this.gameStateService.setNextState('check-shininess');
    this.finishCurrentState();
  }

  /**
   * Registers a pokemon in the Pokédex. For alt-form pokemon (pokemonId > 1025),
   * also registers the base national dex entry so it appears in the Pokédex grid.
   */
  private registerInPokedex(pokemon: PokemonItem): void {
    this.pokedexService.markSeen(pokemon.pokemonId, pokemon.shiny);
    const baseId = this.pokemonFormsService.getBasePokemonId(pokemon.pokemonId);
    if (baseId !== null && baseId !== pokemon.pokemonId) {
      this.pokedexService.markSeen(baseId, pokemon.shiny);
    }
  }
  private replaceForEvolution(pokemonOut: PokemonItem, pokemonIn: PokemonItem): void {
    this.pkmnOut = pokemonOut;
    this.pkmnIn = structuredClone(pokemonIn);
    this.registerInPokedex(pokemonIn);
    this.pkmnEvoTitle = "game.main.roulette.evolve.modal.title"
    this.trainerService.replaceForEvolution(this.pkmnOut, this.pkmnIn);
    this.statsService.recordEvolutionPerformed();

    if (this.evolutionService.isNincadaSpecialEvolution(pokemonOut)) {
      const nincadaEvolutions = this.evolutionService.getEvolutions(pokemonOut);
      const bonusEvolution = nincadaEvolutions.find(evolution => evolution.pokemonId !== pokemonIn.pokemonId);

      if (bonusEvolution) {
        this.trainerService.addToTeam(bonusEvolution);
        this.registerInPokedex(bonusEvolution);
      }
    }

    if (this.trainerService.hasItem('exp-share') && this.expShareUsed === false) {
      this.expShareUsed = true;
      this.expSharePokemon = this.pkmnIn;
      this.secondEvolution();
    } else if (this.trainerService.hasItem('exp-share') && this.expShareUsed === true) {
      this.expShareUsed = false;
      this.expSharePokemon = null;
    }
  }

  private evolveSecondPokemon(pokemon: PokemonItem): void {
    const pokemonEvolutions = this.evolutionService.getEvolutions(pokemon);

    if (pokemonEvolutions.length === 1) {
      this.replaceForEvolution(pokemon, pokemonEvolutions[0]);
    } else {
      this.auxPokemonList = pokemonEvolutions;
      this.currentContextPokemon = pokemon;
      this.customWheelTitle = 'game.main.roulette.evolve.which';
      this.auxPokemonListPickMode = false;
      this.gameStateService.setNextState('select-evolution');
      this.gameStateService.setNextState('select-from-pokemon-list');
    }
  }

  private removeFromTeam(pokemon: PokemonItem): void {
    this.trainerService.removeFromTeam(pokemon);
    this.auxPokemonList = [];
  }

  private playItemFoundAudio(): void {
    void this.soundFxService.playSoundFx(this.itemFoundAudio, 0.25);
  }

  private showpkmnEvoModal(): void {
    this.playItemFoundAudio();
    if (!this.settingsService.currentSettings.lessExplanations) {
      this.modalQueueService.open(this.pkmnEvoModal, {
        centered: true,
        size: 'md'
      }).then(modalRef => {
        const onDone = () => this.finishCurrentState();
        modalRef.result.then(onDone, onDone);
      });
    } else {
      this.finishCurrentState();
    }
  }

  private useEscapeRope(): void {
    const item = this.trainerService.getItem('escape-rope');
    if (item) {
      this.trainerService.removeItem(item);
      this.currentContextItem = item;
      this.gameStateService.setNextState('adventure-continues');

      if (!this.settingsService.currentSettings.lessExplanations) {
        this.modalQueueService.open(this.itemActivateModal, {
          centered: true,
          size: 'md'
        }).then(modalRef => {
          const onDone = () => this.finishCurrentState();
          modalRef.result.then(onDone, onDone);
        });
      } else {
        this.finishCurrentState();
      }
    }
  }
}
