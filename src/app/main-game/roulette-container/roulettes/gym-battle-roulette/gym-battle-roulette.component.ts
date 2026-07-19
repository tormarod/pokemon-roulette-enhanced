import { Component, EventEmitter, Input, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';
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
import { gymLeadersByGeneration } from './gym-leaders-by-generation';
import { MatchupStripComponent } from '../../../matchup-strip/matchup-strip.component';
import { BattlePrepService } from '../../../../services/battle-prep-service/battle-prep.service';
import { BattleDebuffService } from '../../../../services/battle-debuff-service/battle-debuff.service';
import { BattlePrepPanelComponent, BattlePrepConfirmed } from '../../battle-prep-panel/battle-prep-panel.component';
import { MarkedTargetService } from '../../../../services/marked-target-service/marked-target.service';

@Component({
  selector: 'app-gym-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe,
    MatchupStripComponent,
    BattlePrepPanelComponent
  ],
  templateUrl: './gym-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './gym-battle-roulette.component.css'
})
export class GymBattleRouletteComponent extends BaseBattleRouletteComponent {

  private static readonly BATTLE_KEY = 'gym-battle';

  gymLeadersByGeneration = gymLeadersByGeneration;

  @ViewChild('gymLeaderPresentationModal', { static: true }) gymLeaderPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true }) itemUsedModal!: TemplateRef<any>;

  @Input() currentRound!: number;
  @Input() fromLeader!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();
  @Output() fromLeaderChange = new EventEmitter<number>();

  currentLeader!: GymLeader;
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
    if (this.victoryOdds[index].text === 'game.main.roulette.gym.yes') {
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
    this.battlePrepService.commitPrep({ battleKey: GymBattleRouletteComponent.BATTLE_KEY, ...prep });
    this.prepPhase = false;
    this.calcVictoryOdds();
  }

  protected override async onGameStateChange(state: string): Promise<void> {
    if (state === 'gym-battle') {
      this.getCurrentLeader();

      if (!this.gameStateService.isNewExperienceMode) {
        this.prepPhase = false;
        this.calcVictoryOdds();
        this.modalQueueService.open(this.gymLeaderPresentationModal, { centered: true, size: 'lg' });
        return;
      }

      const pendingPrep = this.battlePrepService.getPendingPrep();
      if (pendingPrep && pendingPrep.battleKey === GymBattleRouletteComponent.BATTLE_KEY) {
        this.prepPhase = false;
        this.calcVictoryOdds();
        this.modalQueueService.open(this.gymLeaderPresentationModal, { centered: true, size: 'lg' });
        return;
      }

      this.prepPhase = true;
      this.calcVictoryOdds();
      this.modalQueueService.open(this.gymLeaderPresentationModal, { centered: true, size: 'lg' });
    }
  }

  protected override calcVictoryOdds(): void {
    const prep = this.gameStateService.isNewExperienceMode ? this.battlePrepService.getPendingPrep() : null;
    const xAttackBonus = prep?.xAttackUsed
      ? this.trainerTeam.reduce((sum, p) => sum + p.power, 0) / this.trainerTeam.length
      : 0;
    // Gym battles start with 1 base noOdds
    this.victoryOdds = this.buildVictoryOdds(
      this.currentLeader?.types, 'game.main.roulette.gym', 1, this.currentRound,
      prep?.leadIndex, xAttackBonus
    );
  }

  private getCurrentLeader(): void {
    this.currentLeader = this.gymLeadersByGeneration[this.generation.id][this.currentRound];

    if ((this.generation.id === 5 && (this.currentRound === 0 || this.currentRound === 7))
      || (this.generation.id === 7 && (this.currentRound === 2 || this.currentRound === 4))
      || (this.generation.id === 8 && (this.currentRound === 3 || this.currentRound === 5))) {

      const leaderTypes = Array.isArray(this.currentLeader.types) ? this.currentLeader.types : undefined;

      this.translate.get(this.currentLeader.name).pipe(take(1)).subscribe(translated => {
        const leaderNames = translated.split('/');
        const leaderSprites = Array.isArray(this.currentLeader.sprite) ? this.currentLeader.sprite : [this.currentLeader.sprite];
        const leaderQuotes = Array.isArray(this.currentLeader.quotes) ? this.currentLeader.quotes : this.currentLeader.quotes;
        const randomIndex = Math.floor(Math.random() * leaderNames.length);

        Promise.resolve().then(() => {
          this.fromLeaderChange.emit(randomIndex);

          this.currentLeader = {
            name: leaderNames[randomIndex],
            sprite: leaderSprites[randomIndex],
            quotes: [Array.isArray(leaderQuotes) ? leaderQuotes[randomIndex] : leaderQuotes],
            types: leaderTypes ? [leaderTypes[randomIndex]] : undefined
          } as GymLeader;

          this.calcVictoryOdds();
        });
      });
    }
  }
}