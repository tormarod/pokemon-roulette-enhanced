import { Component, EventEmitter, Input, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { rivalByGeneration } from './rival-by-generation';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { BaseBattleRouletteComponent } from '../base-battle-roulette/base-battle-roulette.component';
import { TypeMatchupService } from '../../../../services/type-matchup-service/type-matchup.service';
import { StatsService } from '../../../../services/stats-service/stats.service';
import { MatchupStripComponent } from '../../../matchup-strip/matchup-strip.component';
import { BattlePrepService } from '../../../../services/battle-prep-service/battle-prep.service';
import { BattlePrepPanelComponent, BattlePrepConfirmed } from '../../battle-prep-panel/battle-prep-panel.component';

@Component({
  selector: 'app-rival-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe,
    MatchupStripComponent,
    BattlePrepPanelComponent
  ],
  templateUrl: './rival-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './rival-battle-roulette.component.css'
})
export class RivalBattleRouletteComponent extends BaseBattleRouletteComponent {

  private static readonly BATTLE_KEY = 'battle-rival';

  rivalByGeneration = rivalByGeneration;

  @ViewChild('rivalPresentationModal', { static: true }) rivalPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true }) itemUsedModal!: TemplateRef<any>;

  @Input() currentRound!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();
  @Output() fromRivalChange = new EventEmitter<number>();

  currentRival!: GymLeader;
  prepPhase = true;

  constructor(
    modalService: NgbModal,
    gameStateService: GameStateService,
    generationService: GenerationService,
    trainerService: TrainerService,
    translate: TranslateService,
    typeMatchupService: TypeMatchupService,
    statsService: StatsService,
    private battlePrepService: BattlePrepService
  ) {
    super(modalService, gameStateService, generationService, trainerService, translate, typeMatchupService, statsService);
  }

  onItemSelected(index: number): void {
    this.recordSpin(index);

    if (!this.gameStateService.isNewExperienceMode) {
      // Classic mode: rival has no retry/potion mechanic — unchanged from today.
      this.battleResultEvent.emit(this.victoryOdds[index].text === 'game.main.roulette.rival.yes');
      return;
    }

    // New Experience mode: same retries/usePotion machinery as gym/Elite Four/Champion.
    this.retries--;
    if (this.victoryOdds[index].text === 'game.main.roulette.rival.yes') {
      this.battlePrepService.clearPrep();
      this.battleResultEvent.emit(true);
    } else {
      if (this.retries <= 0) {
        const potion = this.hasPotions();
        if (potion) {
          this.usePotion(potion, () => this.modalService.open(this.itemUsedModal, { centered: true, size: 'md' }));
        } else {
          this.battlePrepService.clearPrep();
          this.battleResultEvent.emit(false);
        }
      }
    }
  }

  onPrepConfirmed(prep: BattlePrepConfirmed): void {
    this.battlePrepService.commitPrep({ battleKey: RivalBattleRouletteComponent.BATTLE_KEY, ...prep });
    if (prep.potionUsed) {
      const potion = this.trainerItems.find(item => item.name === prep.potionUsed);
      if (potion) {
        this.usePotion(potion, () => this.modalService.open(this.itemUsedModal, { centered: true, size: 'md' }));
      }
    }
    this.prepPhase = false;
    this.calcVictoryOdds();
  }

  protected override onGameStateChange(state: string): void {
    if (state === 'battle-rival') {
      this.getCurrentRival();

      if (!this.gameStateService.isNewExperienceMode) {
        this.prepPhase = false;
        this.calcVictoryOdds();
        this.modalService.open(this.rivalPresentationModal, { centered: true, size: 'lg' });
        return;
      }

      const pendingPrep = this.battlePrepService.getPendingPrep();
      if (pendingPrep && pendingPrep.battleKey === RivalBattleRouletteComponent.BATTLE_KEY) {
        this.prepPhase = false;
        this.calcVictoryOdds();
        this.modalService.open(this.rivalPresentationModal, { centered: true, size: 'lg' });
        return;
      }

      this.prepPhase = true;
      this.calcVictoryOdds();
      this.modalService.open(this.rivalPresentationModal, { centered: true, size: 'lg' });
    }
  }

  protected override calcVictoryOdds(): void {
    const prep = this.gameStateService.isNewExperienceMode ? this.battlePrepService.getPendingPrep() : null;
    const xAttackBonus = prep?.xAttackUsed
      ? this.trainerTeam.reduce((sum, p) => sum + p.power, 0) / this.trainerTeam.length
      : 0;
    // Rival battles mirror the current gym-leader difficulty; start with 1 base noOdds
    this.victoryOdds = this.buildVictoryOdds(
      this.currentRival?.types, 'game.main.roulette.rival', 1, this.currentRound,
      prep?.leadIndex, xAttackBonus
    );
  }

  private getCurrentRival(): void {
    this.currentRival = this.rivalByGeneration[this.generation.id];

    if (this.generation.id === 6) {
      const rivalTypes = Array.isArray(this.currentRival.types) ? this.currentRival.types : undefined;

      this.translate.get(this.currentRival.name).pipe(take(1)).subscribe(translated => {
        const rivalNames = translated.split('/');
        const rivalSprites = Array.isArray(this.currentRival.sprite) ? this.currentRival.sprite : [this.currentRival.sprite];
        const rivalQuotes = Array.isArray(this.currentRival.quotes) ? this.currentRival.quotes : [this.currentRival.quotes];
        // If the player is male, rival is Serena; if female, rival is Calem.
        const selectedIndex = this.trainerService.gender === 'male' ? 1 : 0;

        this.fromRivalChange.emit(selectedIndex);

        this.currentRival = {
          name: rivalNames[selectedIndex],
          sprite: rivalSprites[selectedIndex],
          quotes: [rivalQuotes[selectedIndex]],
          // types is NOT gender-indexed like sprite/name/quotes — Calem and Serena
          // share the same single-element type theme (e.g. ['normal']), so it's
          // carried over as-is. Indexing it by selectedIndex (as if it had one
          // entry per gender variant) went out of bounds for the male index and
          // produced types: [undefined], which crashed the matchup-strip icon
          // render and left the rival battle screen permanently blank.
          types: rivalTypes
        } as GymLeader;

        this.calcVictoryOdds();
      });
    }
  }
}