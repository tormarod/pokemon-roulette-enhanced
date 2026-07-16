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
import { BaseBattleRouletteComponent } from '../base-battle-roulette/base-battle-roulette.component';

@Component({
  selector: 'app-elite-four-battle-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe
  ],
  templateUrl: './elite-four-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './elite-four-battle-roulette.component.css'
})
export class EliteFourBattleRouletteComponent extends BaseBattleRouletteComponent {

  eliteFourByGeneration = eliteFourByGeneration;

  @ViewChild('eliteFourPresentationModal', { static: true }) eliteFourPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true }) itemUsedModal!: TemplateRef<any>;

  @Input() currentRound!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();
  @Output() fromEliteChange = new EventEmitter<number>();

  currentElite!: GymLeader;

  constructor(
    modalService: NgbModal,
    private modalQueueService: ModalQueueService,
    gameStateService: GameStateService,
    generationService: GenerationService,
    trainerService: TrainerService,
    translate: TranslateService,
    typeMatchupService: TypeMatchupService
  ) {
    super(modalService, gameStateService, generationService, trainerService, translate, typeMatchupService);
  }

  onItemSelected(index: number): void {
    this.retries--;
    if (this.victoryOdds[index].text === 'game.main.roulette.elite.yes') {
      this.battleResultEvent.emit(true);
    } else {
      if (this.retries <= 0) {
        const potion = this.hasPotions();
        if (potion) {
          this.usePotion(potion, () => this.modalQueueService.open(this.itemUsedModal, { centered: true, size: 'md' }));
        } else {
          this.battleResultEvent.emit(false);
        }
      }
    }
  }

  protected override async onGameStateChange(state: string): Promise<void> {
    if (state === 'elite-four-battle') {
      this.getCurrentElite();
      this.calcVictoryOdds();
      this.modalQueueService.open(this.eliteFourPresentationModal, { centered: true, size: 'lg' });
    }
  }

  protected override calcVictoryOdds(): void {
    // Elite four battles should be harder, so it starts with 2 base noOdds
    this.victoryOdds = this.buildVictoryOdds(this.currentElite?.types, 'game.main.roulette.elite', 2, this.currentRound);
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