import { Directive, EventEmitter, Input, Output, OnInit, OnDestroy, TemplateRef, inject } from '@angular/core';
import { Subscription, take } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { TypeMatchupService } from '../../../../services/type-matchup-service/type-matchup.service';
import { StatsService } from '../../../../services/stats-service/stats.service';
import { BattleDebuffService } from '../../../../services/battle-debuff-service/battle-debuff.service';
import { AbilityService } from '../../../../services/ability-service/ability.service';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { BattlePrepService } from '../../../../services/battle-prep-service/battle-prep.service';
import { MarkedTargetService } from '../../../../services/marked-target-service/marked-target.service';
import { ScoutingReportService } from '../../../../services/scouting-report-service/scouting-report.service';
import { PcLockService } from '../../../../services/pc-lock-service/pc-lock.service';
import { BattlePrepConfirmed } from '../../battle-prep-panel/battle-prep-panel.component';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { ItemItem } from '../../../../interfaces/item-item';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { PokemonType, getTypeIconUrl } from '../../../../interfaces/pokemon-type';
import { interleaveOdds } from '../../../../utils/odd-utils';
import { BattleOddsService, BattleOddsBreakdown } from '../../../../services/battle-odds-service/battle-odds.service';

@Directive()
export abstract class BaseBattleRouletteComponent implements OnInit, OnDestroy {
  @Input() currentRound!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();

  protected generation!: GenerationItem;
  protected trainerTeam!: PokemonItem[];
  protected trainerItems!: ItemItem[];
  protected currentItem!: ItemItem;
  protected retries = 0;
  protected victoryOdds: WheelItem[] = [];
  protected readonly abilityService = inject(AbilityService);
  protected readonly battleOddsService = inject(BattleOddsService);
  /** Guards the once-per-battle Serene Grace-style free retry (see buildVictoryOdds). */
  private abilityRetryGranted = false;
  /** Full odds breakdown backing the matchup-strip win % + contribution rows; null when the opponent has no configured types. */
  currentOdds: BattleOddsBreakdown | null = null;

  matchupSuperEffectiveTypes: PokemonType[] = [];
  matchupResistTypes: PokemonType[] = [];
  matchupDisadvantageTypes: PokemonType[] = [];
  /** Total power gained/lost across the whole team from the matchup, for display. */
  matchupAdvantageDelta = 0;
  matchupDisadvantageDelta = 0;

  /** New-Experience prep-gating flag; true while the player hasn't confirmed lead/item for this battle yet. */
  prepPhase = true;

  private gameSubscription: Subscription | null = null;
  private generationSubscription: Subscription | null = null;
  private teamSubscription: Subscription | null = null;

  protected readonly modalService = inject(NgbModal);
  protected readonly gameStateService = inject(GameStateService);
  protected readonly generationService = inject(GenerationService);
  protected readonly trainerService = inject(TrainerService);
  protected readonly translate = inject(TranslateService);
  protected readonly typeMatchupService = inject(TypeMatchupService);
  protected readonly statsService = inject(StatsService);
  protected readonly battleDebuffService = inject(BattleDebuffService);
  protected readonly modalQueueService = inject(ModalQueueService);
  protected readonly battlePrepService = inject(BattlePrepService);
  public readonly markedTargetService = inject(MarkedTargetService);
  protected readonly scoutingReportService = inject(ScoutingReportService);
  protected readonly pcLockService = inject(PcLockService);

  // ── Template-method hooks ──────────────────────────────────────────────
  // Placeholder defaults for now; each becomes real per-subclass state as gym/
  // elite-four/rival/champion migrate onto the base. `presentationModalRef`/
  // `itemUsedModalRef` are plain fields (not accessors) so a migrated
  // subclass's @ViewChild-decorated field can shadow them directly — TS
  // forbids a property from overriding an accessor.
  protected readonly battleKey: string = '';
  protected readonly textPrefix: string = '';
  protected readonly baseNoCount: number = 0;
  protected get opponentTypes(): PokemonType[] | undefined { return undefined; }

  /** opponentTypes with the pending scouting-report type appended (New Experience threat). */
  protected get effectiveOpponentTypes(): PokemonType[] | undefined {
    const scouted = this.scoutingReportService.currentType;
    if (!scouted) return this.opponentTypes;
    return [...(this.opponentTypes ?? []), scouted];
  }
  protected presentationModalRef!: TemplateRef<unknown>;
  protected itemUsedModalRef!: TemplateRef<unknown>;
  protected setCurrentOpponent(_opponent: GymLeader): void {}
  protected prepareOpponentForRound(): void {}

  /** Rival overrides to true — Classic mode skips retries/potion/cleanup entirely. */
  protected readonly skipRetriesInClassicMode: boolean = false;
  /** Rival overrides to faint the committed lead (applyFaintOnLoss). */
  protected onFinalLoss(): void {}

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

    const odds = this.battleOddsService.computeOdds({
      team: this.trainerTeam,
      opponentTypes: types,
      baseNoCount,
      currentRound,
      leadIndex,
      xAttackBonus,
      classicPlusModifiers: this.plusModifiers(),
      badOmen: this.battleDebuffService.currentDebuff,
      abilitiesActive: this.gameStateService.isNewExperienceMode,
    });

    // Serene Grace-style: grants one free retry, once per battle instance, the
    // first time this is computed with the ability present. Seeded to 2, not
    // 1: onItemSelected() decrements `retries` on every spin (including the
    // first), and only emits a loss once it hits 0 — so 2 survives the first
    // spin's decrement to actually buy one extra spin, whereas 1 would be
    // spent on that first decrement and grant nothing.
    if (odds.extraRetry && !this.abilityRetryGranted) {
      this.abilityRetryGranted = true;
      this.retries = Math.max(this.retries, 2);
    }

    const yesOdds: WheelItem[] = [];
    for (let i = 0; i < odds.yesTickets; i++) {
      yesOdds.push({ text: yesText, fillStyle: 'green', weight: 1 });
    }

    if (types.length) {
      const { superEffectiveTypes, resistTypes, weakTypes } = this.typeMatchupService.getMatchupTypes(this.trainerTeam, types);
      this.matchupSuperEffectiveTypes = superEffectiveTypes;
      this.matchupResistTypes = resistTypes;
      this.matchupDisadvantageTypes = weakTypes;
      this.matchupAdvantageDelta = odds.yes.typeAdvantage;
      this.matchupDisadvantageDelta = odds.no.typeDisadvantage;
      this.currentOdds = odds;
    } else {
      this.matchupSuperEffectiveTypes = [];
      this.matchupResistTypes = [];
      this.matchupDisadvantageTypes = [];
      this.matchupAdvantageDelta = 0;
      this.matchupDisadvantageDelta = 0;
      this.currentOdds = null;
    }

    const noOdds: WheelItem[] = [];
    for (let i = 0; i < odds.noTickets; i++) {
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
  protected onGameStateChange(state: string): void | Promise<void> {
    if (state !== this.battleKey) return;
    // Elite Four (and any future multi-round battle sharing one component
    // instance across rounds, see prepareOpponentForRound) re-enters this
    // battleKey once per member without the component being recreated — reset
    // here so the once-per-battle retry re-arms for each new round instead of
    // firing only on whichever round first computed it.
    this.abilityRetryGranted = false;
    this.prepareOpponentForRound();
    const pending = this.battlePrepService.getPendingPrep();
    const committed = !!pending && pending.battleKey === this.battleKey;
    this.prepPhase = this.gameStateService.isNewExperienceMode && !committed;
    this.calcVictoryOdds();
    this.openPresentationModal();
  }

  /** Rebuilds victoryOdds from current team, items, and opponent data. */
  protected calcVictoryOdds(): void {
    const prep = this.gameStateService.isNewExperienceMode
      ? this.battlePrepService.getPendingPrep() : null;
    const xAttackBonus = prep?.xAttackUsed
      ? this.battleOddsService.xAttackBonus(this.trainerTeam, this.currentRound) : 0;
    this.victoryOdds = this.buildVictoryOdds(
      this.effectiveOpponentTypes, this.textPrefix, this.baseNoCount, this.currentRound,
      prep?.leadIndex, xAttackBonus
    );
  }

  onItemSelected(index: number): void {
    this.recordSpin(index);
    const landedYes = this.victoryOdds[index].text === `${this.textPrefix}.yes`;

    if (this.skipRetriesInClassicMode && !this.gameStateService.isNewExperienceMode) {
      this.battleResultEvent.emit(landedYes);
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
        this.onFinalLoss();
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

  private finishBattleCleanup(): void {
    this.battlePrepService.clearPrep();
    this.trainerService.clearForcedRetreatLock();
    this.markedTargetService.clearMark();
    this.battleDebuffService.clearDebuff();
    this.scoutingReportService.clearType();
    this.pcLockService.clearLock();
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
}
