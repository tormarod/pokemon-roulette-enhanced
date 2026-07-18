import { Component, EventEmitter, Input, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { championByGeneration } from './champion-by-generation';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { take } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { BaseBattleRouletteComponent } from '../base-battle-roulette/base-battle-roulette.component';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { TypeMatchupService } from '../../../../services/type-matchup-service/type-matchup.service';
import { StatsService } from '../../../../services/stats-service/stats.service';
import { MatchupStripComponent } from '../../../matchup-strip/matchup-strip.component';
import { BattlePrepService } from '../../../../services/battle-prep-service/battle-prep.service';
import { BattleDebuffService } from '../../../../services/battle-debuff-service/battle-debuff.service';
import { BattlePrepPanelComponent, BattlePrepConfirmed } from '../../battle-prep-panel/battle-prep-panel.component';

@Component({
  selector: 'app-champion-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe,
    MatchupStripComponent,
    BattlePrepPanelComponent
  ],
  templateUrl: './champion-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './champion-battle-roulette.component.css'
})
export class ChampionBattleRouletteComponent extends BaseBattleRouletteComponent {

  private static readonly BATTLE_KEY = 'champion-battle';

  championByGeneration = championByGeneration;

  @ViewChild('championPresentationModal', { static: true }) championPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true }) itemUsedModal!: TemplateRef<any>;

  @Input() currentRound!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();
  @Output() fromChampionChange = new EventEmitter<number>();

  currentChampion: GymLeader = { name: '', sprite: '', quotes: [''] };
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
    private battlePrepService: BattlePrepService
  ) {
    super(modalService, gameStateService, generationService, trainerService, translate, typeMatchupService, statsService, battleDebuffService);
  }

  onItemSelected(index: number): void {
    this.recordSpin(index);
    this.retries--;
    if (this.victoryOdds[index].text === 'game.main.roulette.champion.yes') {
      this.battlePrepService.clearPrep();
      this.battleDebuffService.clearDebuff();
      this.battleResultEvent.emit(true);
    } else {
      if (this.retries <= 0) {
        const potion = this.hasPotions();
        if (potion) {
          this.usePotion(potion, () => this.modalService.open(this.itemUsedModal, { centered: true, size: 'md' }));
        } else {
          this.battlePrepService.clearPrep();
          this.battleDebuffService.clearDebuff();
          this.battleResultEvent.emit(false);
        }
      }
    }
  }

  onPrepConfirmed(prep: BattlePrepConfirmed): void {
    this.battlePrepService.commitPrep({ battleKey: ChampionBattleRouletteComponent.BATTLE_KEY, ...prep });
    if (prep.potionUsed) {
      const potion = this.trainerItems.find(item => item.name === prep.potionUsed);
      if (potion) {
        this.usePotion(potion, () => this.modalService.open(this.itemUsedModal, { centered: true, size: 'md' }));
      }
    }
    this.prepPhase = false;
    this.calcVictoryOdds();
  }

  protected override async onGameStateChange(state: string): Promise<void> {
    if (state === 'champion-battle') {
      this.getCurrentChampion();

      if (!this.gameStateService.isNewExperienceMode) {
        this.prepPhase = false;
        this.calcVictoryOdds();
        this.modalService.open(this.championPresentationModal, { centered: true, size: 'lg' });
        return;
      }

      const pendingPrep = this.battlePrepService.getPendingPrep();
      if (pendingPrep && pendingPrep.battleKey === ChampionBattleRouletteComponent.BATTLE_KEY) {
        this.prepPhase = false;
        this.calcVictoryOdds();
        this.modalService.open(this.championPresentationModal, { centered: true, size: 'lg' });
        return;
      }

      this.prepPhase = true;
      this.calcVictoryOdds();
      this.modalService.open(this.championPresentationModal, { centered: true, size: 'lg' });
    }
  }

  protected override calcVictoryOdds(): void {
    const prep = this.gameStateService.isNewExperienceMode ? this.battlePrepService.getPendingPrep() : null;
    const xAttackBonus = prep?.xAttackUsed
      ? this.trainerTeam.reduce((sum, p) => sum + p.power, 0) / this.trainerTeam.length
      : 0;
    // Champion battles should be the toughest, so they start with 3 base noOdds
    this.victoryOdds = this.buildVictoryOdds(
      this.currentChampion?.types, 'game.main.roulette.champion', 3, this.currentRound,
      prep?.leadIndex, xAttackBonus
    );
  }

  private getCurrentChampion(): void {
    this.currentChampion = this.championByGeneration[this.generation.id][0];

    if (this.generation.id === 7) {
      const championTypes = Array.isArray(this.currentChampion.types) ? this.currentChampion.types : undefined;

      this.translate.get(this.currentChampion.name).pipe(take(1)).subscribe(translated => {
        const championNames = translated.split('/');
        const championSprites = Array.isArray(this.currentChampion.sprite) ? this.currentChampion.sprite : [this.currentChampion.sprite];
        const championQuotes = Array.isArray(this.currentChampion.quotes) ? this.currentChampion.quotes : this.currentChampion.quotes;
        const randomIndex = Math.floor(Math.random() * championNames.length);

        this.fromChampionChange.emit(randomIndex);

        this.currentChampion = {
          name: championNames[randomIndex],
          sprite: championSprites[randomIndex],
          quotes: [Array.isArray(championQuotes) ? championQuotes[randomIndex] : championQuotes],
          types: championTypes ? [championTypes[randomIndex]] : undefined
        } as GymLeader;

        this.calcVictoryOdds();
      });
    }
  }
}