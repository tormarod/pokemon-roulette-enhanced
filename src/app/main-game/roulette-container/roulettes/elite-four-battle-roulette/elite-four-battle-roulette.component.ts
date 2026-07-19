import { Component, EventEmitter, Input, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { eliteFourByGeneration } from './elite-four-by-generation';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { TypeMatchupService } from '../../../../services/type-matchup-service/type-matchup.service';
import { StatsService } from '../../../../services/stats-service/stats.service';
import { BaseBattleRouletteComponent } from '../base-battle-roulette/base-battle-roulette.component';
import { MatchupStripComponent } from '../../../matchup-strip/matchup-strip.component';
import { BattlePrepService } from '../../../../services/battle-prep-service/battle-prep.service';
import { BattleDebuffService } from '../../../../services/battle-debuff-service/battle-debuff.service';
import { BattlePrepPanelComponent, BattlePrepConfirmed } from '../../battle-prep-panel/battle-prep-panel.component';
import { MarkedTargetService } from '../../../../services/marked-target-service/marked-target.service';

@Component({
  selector: 'app-elite-four-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe,
    MatchupStripComponent,
    BattlePrepPanelComponent
  ],
  templateUrl: './elite-four-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './elite-four-battle-roulette.component.css'
})
export class EliteFourBattleRouletteComponent extends BaseBattleRouletteComponent {

  private static readonly BATTLE_KEY = 'elite-four-battle';

  eliteFourByGeneration = eliteFourByGeneration;

  @ViewChild('eliteFourPresentationModal', { static: true }) eliteFourPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true }) itemUsedModal!: TemplateRef<any>;

  @Input() currentRound!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();
  @Output() fromEliteChange = new EventEmitter<number>();

  currentElite!: GymLeader;
  prepPhase = true;

  constructor(
    modalService: NgbModal,
    private modalQueueService: ModalQueueService,
    gameStateService: GameStateService,
    generationService: GenerationService,
    trainerService: TrainerService,
    translate: TranslateService,
    typeMatchupService: TypeMatchupService,
    statsService: StatsService,
    battleDebuffService: BattleDebuffService,
    private battlePrepService: BattlePrepService,
    public markedTargetService: MarkedTargetService
  ) {
    super(modalService, gameStateService, generationService, trainerService, translate, typeMatchupService, statsService, battleDebuffService);
  }

  onItemSelected(index: number): void {
    this.recordSpin(index);
    this.retries--;
    if (this.victoryOdds[index].text === 'game.main.roulette.elite.yes') {
      this.battlePrepService.clearPrep();
      this.trainerService.clearForcedRetreatLock();
      this.markedTargetService.clearMark();
      this.battleDebuffService.clearDebuff();
      this.battleResultEvent.emit(true);
    } else {
      if (this.retries <= 0) {
        const potion = this.hasPotions();
        if (potion) {
          this.usePotion(potion, () => this.modalQueueService.open(this.itemUsedModal, { centered: true, size: 'md' }));
        } else {
          this.battlePrepService.clearPrep();
          this.trainerService.clearForcedRetreatLock();
          this.markedTargetService.clearMark();
          this.battleDebuffService.clearDebuff();
          this.battleResultEvent.emit(false);
        }
      }
    }
  }

  onPrepConfirmed(prep: BattlePrepConfirmed): void {
    this.battlePrepService.commitPrep({ battleKey: EliteFourBattleRouletteComponent.BATTLE_KEY, ...prep });
    this.prepPhase = false;
    this.calcVictoryOdds();
  }

  protected override async onGameStateChange(state: string): Promise<void> {
    if (state === 'elite-four-battle') {
      this.getCurrentElite();

      if (!this.gameStateService.isNewExperienceMode) {
        this.prepPhase = false;
        this.calcVictoryOdds();
        this.modalQueueService.open(this.eliteFourPresentationModal, { centered: true, size: 'lg' });
        return;
      }

      const pendingPrep = this.battlePrepService.getPendingPrep();
      if (pendingPrep && pendingPrep.battleKey === EliteFourBattleRouletteComponent.BATTLE_KEY) {
        this.prepPhase = false;
        this.calcVictoryOdds();
        this.modalQueueService.open(this.eliteFourPresentationModal, { centered: true, size: 'lg' });
        return;
      }

      this.prepPhase = true;
      this.calcVictoryOdds();
      this.modalQueueService.open(this.eliteFourPresentationModal, { centered: true, size: 'lg' });
    }
  }

  protected override calcVictoryOdds(): void {
    const prep = this.gameStateService.isNewExperienceMode ? this.battlePrepService.getPendingPrep() : null;
    const xAttackBonus = prep?.xAttackUsed
      ? this.trainerTeam.reduce((sum, p) => sum + p.power, 0) / this.trainerTeam.length
      : 0;
    // Elite four battles should be harder, so it starts with 2 base noOdds
    this.victoryOdds = this.buildVictoryOdds(
      this.currentElite?.types, 'game.main.roulette.elite', 2, this.currentRound,
      prep?.leadIndex, xAttackBonus
    );
  }

  private getCurrentElite(): void {
    this.currentElite = this.eliteFourByGeneration[this.generation.id][this.currentRound % 4];

    if (this.generation.id === 8 && (this.currentRound % 4 === 0 || this.currentRound % 4 === 2)) {
      const eliteTypes = Array.isArray(this.currentElite.types) ? this.currentElite.types : undefined;

      this.translate.get(this.currentElite.name).pipe(take(1)).subscribe(translated => {
        const eliteNames = translated.split('/');
        const eliteSprites = Array.isArray(this.currentElite.sprite) ? this.currentElite.sprite : [this.currentElite.sprite];
        const eliteQuotes = Array.isArray(this.currentElite.quotes) ? this.currentElite.quotes : this.currentElite.quotes;
        const randomIndex = Math.floor(Math.random() * eliteNames.length);

        this.fromEliteChange.emit(randomIndex);

        this.currentElite = {
          name: eliteNames[randomIndex],
          sprite: eliteSprites[randomIndex],
          quotes: [Array.isArray(eliteQuotes) ? eliteQuotes[randomIndex] : eliteQuotes],
          types: eliteTypes ? [eliteTypes[randomIndex]] : undefined
        } as GymLeader;

        this.calcVictoryOdds();
      });
    }
  }
}