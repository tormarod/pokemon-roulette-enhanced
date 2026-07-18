import { Component, DestroyRef, EventEmitter, inject, OnDestroy, OnInit, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
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
import { TypeBiasItemService } from '../../services/type-bias-item-service/type-bias-item.service';
import { LinkCableService } from '../../services/link-cable-service/link-cable.service';
import { PokemonType, getTypeIconUrl } from '../../interfaces/pokemon-type';
import { GenerationService } from '../../services/generation-service/generation.service';
import { GenerationItem } from '../../interfaces/generation-item';
import { GymLeader } from '../../interfaces/gym-leader';
import { gymLeadersByGeneration } from './roulettes/gym-battle-roulette/gym-leaders-by-generation';
import { eliteFourByGeneration } from './roulettes/elite-four-battle-roulette/elite-four-by-generation';
import { championByGeneration } from './roulettes/champion-battle-roulette/champion-by-generation';
import { StatsService } from '../../services/stats-service/stats.service';
import { BattleDebuffService } from '../../services/battle-debuff-service/battle-debuff.service';

/** V2 "badOmen" threat: extra No tickets on the next battle. */
const BADOMEN_DEBUFF_AMOUNT = 2;

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
    GameOverComponent
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
      private generationService: GenerationService,
      private statsService: StatsService,
      private battleDebuffService: BattleDebuffService) {
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
          if (this.runningShoesUsed) {
            this.respinReason = 'items.running-shoes.name';
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
  }

  ngOnDestroy(): void {
    this.rareCandySubscription?.unsubscribe();
    this.megaStoneSubscription?.unsubscribe();
    this.typeBiasItemSubscription?.unsubscribe();
    this.linkCableSubscription?.unsubscribe();
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
  multitaskCounter: number = 0;
  pkmnEvoTitle = '';
  pkmnIn!: PokemonItem;
  pkmnOut!: PokemonItem;
  pkmnTradeTitle = '';
  respinReason = '';
  runningShoesUsed: boolean = false;
  stolenPokemon!: PokemonItem | null;
  wheelSpinning: boolean = false;
  private megaSelectionMode: 'none' | 'battle-award-pokemon' | 'battle-award-stone' = 'none';
  private pendingMegaAwardPokemon: PokemonItem | null = null;
  /** True only while the 'select-from-item-list' screen is up for the toll threat's item pick. */
  private tollSelectionMode = false;

  getGameState(): string {
    return this.currentGameState;
  }

  private finishCurrentState(): void {

    this.gameStateService.finishCurrentState();

    if (this.currentGameState === 'adventure-continues') {
      if (this.trainerService.hasItem('running-shoes') && !this.runningShoesUsed) {
        this.runningShoesUsed = true;
        this.gameStateService.setNextState('adventure-continues');
      }
    }
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
      case 'toll-pokemon': {
        // Same weak-biased pick as steal-pokemon, but a toll payment is gone
        // for good — unlike a Team Rocket steal, it's never set as
        // `stolenPokemon` and so can never be recovered by defeating anyone.
        const index = this.auxPokemonList.indexOf(pokemon);
        const original = index !== -1 ? this.stealCandidates[index] : pokemon;
        this.removeFromTeam(original);
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

    if (this.handleTollItemSelection(item)) {
      return;
    }
  }

  /**
   * V2 "toll" threat (New Experience only): the player picked which item to
   * hand over. removeItem() alone is the commit — no confirmation modal,
   * matching the low-ceremony bias-item pattern (handleTypeBiasItemUse).
   */
  private handleTollItemSelection(item: ItemItem): boolean {
    if (!this.tollSelectionMode) {
      return false;
    }
    this.tollSelectionMode = false;
    this.auxItemList = [];
    this.trainerService.removeItem(item);
    this.doNothing();
    return true;
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
    this.runningShoesUsed = false;
    this.respinReason = '';

    if (result) {
      this.statsService.recordBattleWin('gym');
      this.playItemFoundAudio();
      this.trainerService.addBadge(this.leadersDefeatedAmount, this.fromLeader);
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

    const subscription = modalRef.componentInstance.selectedTypeEvent.subscribe((type: PokemonType) => {
      this.trainerService.removeItem(item);
      this.applyBiasForItem(item, type);
      modalRef.close();
    });

    modalRef.result.finally(() => subscription.unsubscribe());
  }

  getTypeIconUrl(type: PokemonType): string {
    return getTypeIconUrl(type);
  }

  continueWithType(type: PokemonType): void {
    this.finishCurrentState();

    const item = this.pendingTypeBiasItem;
    this.pendingTypeBiasItem = null;
    if (!item) {
      return;
    }

    this.applyBiasForItem(item, type);
  }

  /**
   * Honey/Poké Radar boost TOWARD the chosen type; Repel/Max Repel steer AWAY
   * from it. Each use appends an entry (see TrainerService) rather than
   * overwriting, so repeated uses stack instead of replacing each other.
   */
  private applyBiasForItem(item: ItemItem, type: PokemonType): void {
    const mode = item.name === 'poke-radar' || item.name === 'max-repel' ? 'hard' : 'soft';
    if (item.name === 'honey' || item.name === 'poke-radar') {
      this.trainerService.setTowardBias({ type, mode });
    } else {
      this.trainerService.setAwayBias({ type, mode });
    }
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
    this.gameStateService.setNextState('explore-cave');
    this.finishCurrentState();
  }

  snorlaxEncounter(): void {
    this.gameStateService.setNextState('snorlax-encounter');
    this.finishCurrentState();
  }

  multitask(): void {
    this.gameStateService.setNextState('adventure-continues');
    this.gameStateService.setNextState('adventure-continues');
    this.multitaskCounter = this.multitaskCounter + 2;
    this.respinReason = 'Multitask x' + this.multitaskCounter;
    this.finishCurrentState();
  }

  goFishing(): void {
    this.gameStateService.setNextState('go-fishing');
    this.finishCurrentState();
  }

  findFossil(): void {
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

  /**
   * V2 "toll" threat (New Experience only): the player picks an item to hand
   * over; with no items held, it costs a team Pokémon instead (reused
   * weak-biased pick — see the 'toll-pokemon' case in continueWithPokemon()).
   */
  toll(): void {
    const items = this.trainerService.getItems();
    if (items.length > 0) {
      this.auxItemList = items;
      this.customWheelTitle = 'game.main.roulette.adventure.threats.toll.pickItem';
      this.tollSelectionMode = true;
      this.gameStateService.setNextState('select-from-item-list');
      this.finishCurrentState();
      return;
    }

    const trainerTeam = this.trainerService.getTeam();
    if (trainerTeam.length < 2) {
      // Never take the player's only Pokémon — nothing left to demand.
      this.doNothing();
      return;
    }

    this.stealCandidates = trainerTeam;
    this.auxPokemonList = this.weightByInversePower(trainerTeam);
    this.customWheelTitle = 'game.main.roulette.adventure.threats.toll.pickPokemon';
    this.auxPokemonListPickMode = false;
    this.gameStateService.setNextState('toll-pokemon');
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
    this.runningShoesUsed = false;
    this.respinReason = '';

    if (result) {
      this.statsService.recordBattleWin('eliteFour');
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
    this.runningShoesUsed = false;
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
