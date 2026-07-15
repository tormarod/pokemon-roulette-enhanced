import { Directive, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { TypeMatchupService } from '../../../../services/type-matchup-service/type-matchup.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { ItemItem } from '../../../../interfaces/item-item';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonType, pokemonTypeDataByKey } from '../../../../interfaces/pokemon-type';
import { interleaveOdds } from '../../../../utils/odd-utils';

@Directive()
export abstract class BaseBattleRouletteComponent implements OnInit, OnDestroy {
  protected generation!: GenerationItem;
  protected trainerTeam!: PokemonItem[];
  protected trainerItems!: ItemItem[];
  protected currentItem!: ItemItem;
  protected retries = 0;
  protected victoryOdds: WheelItem[] = [];

  matchupAdvantageTypes: PokemonType[] = [];
  matchupDisadvantageTypes: PokemonType[] = [];
  /** Total power gained/lost across the whole team from the matchup, for display. */
  matchupAdvantageDelta = 0;
  matchupDisadvantageDelta = 0;

  protected readonly typeIconBaseUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/types/generation-viii/brilliant-diamond-shining-pearl';

  private gameSubscription: Subscription | null = null;
  private generationSubscription: Subscription | null = null;
  private teamSubscription: Subscription | null = null;

  constructor(
    protected readonly modalService: NgbModal,
    protected readonly gameStateService: GameStateService,
    protected readonly generationService: GenerationService,
    protected readonly trainerService: TrainerService,
    protected readonly translate: TranslateService,
    protected readonly typeMatchupService: TypeMatchupService
  ) {}

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
    });

    this.trainerItems = this.trainerService.getItems();

    this.teamSubscription = this.trainerService.getTeamObservable().subscribe(team => {
      this.trainerTeam = team;
      this.calcVictoryOdds();
    });

    this.gameSubscription = this.gameStateService.currentState.subscribe(state => {
      this.onGameStateChange(state);
    });
  }

  ngOnDestroy(): void {
    this.gameSubscription?.unsubscribe();
    this.generationSubscription?.unsubscribe();
    this.teamSubscription?.unsubscribe();
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  getTypeIconUrl(type: PokemonType): string {
    return `${this.typeIconBaseUrl}/${pokemonTypeDataByKey[type].id}.png`;
  }

  protected plusModifiers(): number {
    let power = 0;
    const xAttacks = this.trainerItems.filter(item => item.name === 'x-attack');
    xAttacks.forEach(() => {
      const meanPower = this.trainerTeam.reduce((sum, pokemon) => sum + pokemon.power, 0) / this.trainerTeam.length;
      power += meanPower;
    });
    return power;
  }

  /**
   * Builds the yes/no ticket pool shared by every battle type: 1 base yes ticket,
   * team power adjusted for type matchup (see TypeMatchupService), the x-attack
   * bonus, and round-scaled no tickets topped up by any type disadvantage.
   * `opponentTypes` may be empty (e.g. a champion/rival entry that has no types
   * configured), in which case the type matchup contributes nothing and the
   * type-icon state is cleared.
   */
  protected buildVictoryOdds(
    opponentTypes: PokemonType[] | undefined,
    textPrefix: string,
    baseNoCount: number,
    currentRound: number
  ): WheelItem[] {
    const yesText = `${textPrefix}.yes`;
    const noText = `${textPrefix}.no`;
    const types = opponentTypes?.length ? opponentTypes : [];

    const { yesPower, noBonus, advantageDelta, disadvantageDelta } =
      this.typeMatchupService.calcTeamMatchupTotals(this.trainerTeam, types);

    const effectivePower = yesPower + this.plusModifiers();
    const yesOdds: WheelItem[] = [];
    for (let i = 0; i < Math.round(effectivePower) + 1; i++) {
      yesOdds.push({ text: yesText, fillStyle: 'green', weight: 1 });
    }

    if (types.length) {
      const { advantageTypes, disadvantageTypes } = this.typeMatchupService.getMatchupTypes(this.trainerTeam, types);
      this.matchupAdvantageTypes = advantageTypes;
      this.matchupDisadvantageTypes = disadvantageTypes;
      this.matchupAdvantageDelta = advantageDelta;
      this.matchupDisadvantageDelta = disadvantageDelta;
    } else {
      this.matchupAdvantageTypes = [];
      this.matchupDisadvantageTypes = [];
      this.matchupAdvantageDelta = 0;
      this.matchupDisadvantageDelta = 0;
    }

    const noOdds: WheelItem[] = [];
    for (let i = 0; i < baseNoCount + currentRound + noBonus; i++) {
      noOdds.push({ text: noText, fillStyle: 'crimson', weight: 1 });
    }

    return interleaveOdds(yesOdds, noOdds);
  }

  protected hasPotions(): ItemItem | undefined {
    return this.trainerItems.find(item =>
      item.name === 'potion' || item.name === 'super-potion' || item.name === 'hyper-potion'
    );
  }

  /**
   * Removes the potion from the trainer's inventory, sets retries, then invokes
   * the caller-supplied modal opener. The lambda is provided by the subclass so
   * that gym/elite-four can use ModalQueueService while champion uses NgbModal directly.
   */
  protected usePotion(potion: ItemItem, openItemUsedModal: () => void): void {
    const index = this.trainerItems.indexOf(potion);
    this.currentItem = potion;
    if (index !== -1) {
      this.trainerItems.splice(index, 1);
      this.trainerService.removeItem(potion);
    }
    switch (potion.name) {
      case 'potion': this.retries = 1; break;
      case 'super-potion': this.retries = 2; break;
      case 'hyper-potion': this.retries = 3; break;
    }
    openItemUsedModal();
  }

  /** Called for every game state change. Subclass checks its own trigger state. */
  protected abstract onGameStateChange(state: string): void | Promise<void>;

  /** Rebuilds victoryOdds from current team, items, and opponent data. */
  protected abstract calcVictoryOdds(): void;
}
