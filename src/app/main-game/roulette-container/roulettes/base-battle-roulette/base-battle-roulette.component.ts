import { Directive, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { TypeMatchupService } from '../../../../services/type-matchup-service/type-matchup.service';
import { StatsService } from '../../../../services/stats-service/stats.service';
import { BattleDebuffService } from '../../../../services/battle-debuff-service/battle-debuff.service';
import { AbilityService } from '../../../../services/ability-service/ability.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { ItemItem } from '../../../../interfaces/item-item';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonType, getTypeIconUrl } from '../../../../interfaces/pokemon-type';
import { interleaveOdds } from '../../../../utils/odd-utils';

@Directive()
export abstract class BaseBattleRouletteComponent implements OnInit, OnDestroy {
  protected generation!: GenerationItem;
  protected trainerTeam!: PokemonItem[];
  protected trainerItems!: ItemItem[];
  protected currentItem!: ItemItem;
  protected retries = 0;
  protected victoryOdds: WheelItem[] = [];
  protected readonly abilityService = inject(AbilityService);
  /** Guards the once-per-battle Serene Grace-style free retry (see buildVictoryOdds). */
  private abilityRetryGranted = false;

  matchupSuperEffectiveTypes: PokemonType[] = [];
  matchupResistTypes: PokemonType[] = [];
  matchupDisadvantageTypes: PokemonType[] = [];
  /** Total power gained/lost across the whole team from the matchup, for display. */
  matchupAdvantageDelta = 0;
  matchupDisadvantageDelta = 0;
  /** i18n name keys of every team member's assigned ability this battle (New Experience only), for the UI badge. */
  activeAbilityNames: string[] = [];

  private static readonly ROUND_THREAT_MULT = 1.5;

  private gameSubscription: Subscription | null = null;
  private generationSubscription: Subscription | null = null;
  private teamSubscription: Subscription | null = null;

  constructor(
    protected readonly modalService: NgbModal,
    protected readonly gameStateService: GameStateService,
    protected readonly generationService: GenerationService,
    protected readonly trainerService: TrainerService,
    protected readonly translate: TranslateService,
    protected readonly typeMatchupService: TypeMatchupService,
    protected readonly statsService: StatsService,
    protected readonly battleDebuffService: BattleDebuffService
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
    return getTypeIconUrl(type);
  }

  /**
   * Classic mode: passively scans every x-attack in inventory and applies it,
   * every battle, without ever consuming it. Under New Experience, x-attack
   * becomes an explicit, consumed, pre-spin choice instead — its bonus comes
   * from the committed prep's xAttackBonus (see buildVictoryOdds), so this
   * returns 0 there to avoid double-counting.
   */
  protected plusModifiers(): number {
    if (this.gameStateService.isNewExperienceMode) {
      return 0;
    }
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
    currentRound: number,
    leadIndex?: number,
    xAttackBonus?: number
  ): WheelItem[] {
    const yesText = `${textPrefix}.yes`;
    const noText = `${textPrefix}.no`;
    const types = opponentTypes?.length ? opponentTypes : [];

    const { yesPower, noBonus, advantageDelta, disadvantageDelta } =
      this.typeMatchupService.calcTeamMatchupTotals(this.trainerTeam, types);

    let leadAdvantageDelta = 0;
    let leadDisadvantageDelta = 0;
    if (leadIndex != null && types.length && this.trainerTeam[leadIndex]) {
      const leadDelta = this.typeMatchupService.getMemberSignedDelta(this.trainerTeam[leadIndex], types);
      if (leadDelta > 0) leadAdvantageDelta = leadDelta;
      else if (leadDelta < 0) leadDisadvantageDelta = -leadDelta;
    }

    // Abilities (New Experience only — Classic mode never has an active ability,
    // regardless of what's curated in abilities-data.ts).
    let abilityYesBonus = 0;
    let abilityNoBonus = 0;
    this.activeAbilityNames = [];
    if (this.gameStateService.isNewExperienceMode) {
      this.activeAbilityNames = this.trainerTeam
        .map(member => this.abilityService.getMemberAbility(member)?.name)
        .filter((name): name is string => !!name);
      const abilities = this.abilityService.applyTeamAbilities(this.trainerTeam, types);
      abilityYesBonus = abilities.yesBonus;
      abilityNoBonus = abilities.noBonus;
      // Serene Grace-style: grants one free retry, once per battle instance,
      // the first time this is computed with the ability present. Seeded to 2,
      // not 1: onItemSelected() decrements `retries` on every spin (including the
      // first), and only emits a loss once it hits 0 — so 2 survives the first
      // spin's decrement to actually buy one extra spin, whereas 1 would be
      // spent on that first decrement and grant nothing.
      if (abilities.extraRetry && !this.abilityRetryGranted) {
        this.abilityRetryGranted = true;
        this.retries = Math.max(this.retries, 2);
      }
    }

    const effectivePower = yesPower + leadAdvantageDelta + (xAttackBonus ?? 0) + this.plusModifiers() + abilityYesBonus;
    const yesOdds: WheelItem[] = [];
    for (let i = 0; i < Math.round(effectivePower) + 1; i++) {
      yesOdds.push({ text: yesText, fillStyle: 'green', weight: 1 });
    }

    if (types.length) {
      const { superEffectiveTypes, resistTypes, weakTypes } = this.typeMatchupService.getMatchupTypes(this.trainerTeam, types);
      this.matchupSuperEffectiveTypes = superEffectiveTypes;
      this.matchupResistTypes = resistTypes;
      this.matchupDisadvantageTypes = weakTypes;
      this.matchupAdvantageDelta = advantageDelta + leadAdvantageDelta;
      this.matchupDisadvantageDelta = disadvantageDelta + leadDisadvantageDelta;
    } else {
      this.matchupSuperEffectiveTypes = [];
      this.matchupResistTypes = [];
      this.matchupDisadvantageTypes = [];
      this.matchupAdvantageDelta = 0;
      this.matchupDisadvantageDelta = 0;
    }

    const noOdds: WheelItem[] = [];
    const roundThreat = Math.ceil(currentRound * BaseBattleRouletteComponent.ROUND_THREAT_MULT);
    // "Bad omen" threat (New Experience only — always 0 otherwise): extra No
    // tickets for the very next battle, cleared once that battle resolves.
    const badOmenBonus = this.battleDebuffService.currentDebuff;
    // Ability No-reduction is floored at baseNoCount — an ability can make a
    // battle easier, never risk-free.
    const rawNoCount = baseNoCount + roundThreat + noBonus + leadDisadvantageDelta + badOmenBonus + abilityNoBonus;
    const noCount = Math.max(baseNoCount, rawNoCount);
    for (let i = 0; i < noCount; i++) {
      noOdds.push({ text: noText, fillStyle: 'crimson', weight: 1 });
    }

    return interleaveOdds(yesOdds, noOdds);
  }

  /**
   * Records a wheel spin's outcome against its pre-spin yes-share, for the
   * luck index (plan §3 Group A). Call with the selected wheel index before
   * any retry/potion bookkeeping mutates state — `victoryOdds` at that point
   * is exactly what the player saw when the wheel stopped.
   */
  protected recordSpin(index: number): void {
    const total = this.victoryOdds.length;
    if (total === 0) {
      return;
    }
    const yesCount = this.victoryOdds.filter(item => item.text.endsWith('.yes')).length;
    const landedYes = this.victoryOdds[index].text.endsWith('.yes');
    this.statsService.recordSpin(landedYes, yesCount / total);
  }

  /** Weakest to strongest, so weaker potions get used up before stronger ones. */
  private static readonly potionRanking = ['potion', 'super-potion', 'hyper-potion'];

  protected hasPotions(): ItemItem | undefined {
    for (const name of BaseBattleRouletteComponent.potionRanking) {
      const match = this.trainerItems.find(item => item.name === name);
      if (match) return match;
    }
    return undefined;
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
    this.statsService.recordPotionUsed();
    openItemUsedModal();
  }

  /** Called for every game state change. Subclass checks its own trigger state. */
  protected abstract onGameStateChange(state: string): void | Promise<void>;

  /** Rebuilds victoryOdds from current team, items, and opponent data. */
  protected abstract calcVictoryOdds(): void;
}
