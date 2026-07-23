import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { EventSource } from '../../../EventSource';
import { ModalQueueService } from '../../../../services/modal-queue-service/modal-queue.service';
import { EventPopupComponent } from '../../../../event-popup/event-popup.component';

@Component({
  selector: 'app-elite-four-prep-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './elite-four-prep-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './elite-four-prep-roulette.component.css'
})
export class EliteFourPrepRouletteComponent implements OnInit {

  constructor(
    private modalQueueService: ModalQueueService,
    private translateService: TranslateService
  ) { }

  async ngOnInit(): Promise<void> {
    const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'lg', windowClass: 'event-popup-modal' });
    modalRef.componentInstance.title = this.translateService.instant('game.main.roulette.elite.prep.victoryRoad');
    modalRef.componentInstance.images = [{ src: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/494.png', alt: 'Good Luck!' }];
    modalRef.componentInstance.lines = [
      this.translateService.instant('game.main.roulette.elite.prep.congrats'),
      this.translateService.instant('game.main.roulette.elite.prep.defeated'),
      this.translateService.instant('game.main.roulette.elite.prep.ready')
    ];
    modalRef.componentInstance.buttons = [{ label: this.translateService.instant('game.main.roulette.elite.prep.go'), variant: 'primary' }];
  }

  @Input() respinReason!: string;
  @Output() battleTrainerEvent = new EventEmitter<EventSource>();
  @Output() buyPotionsEvent = new EventEmitter<void>();
  @Output() catchTwoPokemonEvent = new EventEmitter<void>();
  @Output() catchThreePokemonEvent = new EventEmitter<void>();
  @Output() legendaryEncounterEvent = new EventEmitter<void>();
  @Output() findItemEvent = new EventEmitter<void>();
  @Output() teamRocketEncounterEvent = new EventEmitter<void>();

  actions: WheelItem[] = [
    { text: 'game.main.roulette.elite.prep.actions.trainingArc', fillStyle: 'crimson', weight: 2 },
    { text: 'game.main.roulette.elite.prep.actions.buyPotions', fillStyle: 'darkorange', weight: 2 },
    { text: 'game.main.roulette.elite.prep.actions.catchTwoPokemon', fillStyle: 'darkgoldenrod', weight: 2 },
    { text: 'game.main.roulette.elite.prep.actions.catchThreePokemon', fillStyle: 'green', weight: 2 },
    { text: 'game.main.roulette.elite.prep.actions.huntLegendary', fillStyle: 'darkgreen', weight: 2 },
    { text: 'game.main.roulette.elite.prep.actions.findItem', fillStyle: 'darkcyan', weight: 2 },
    { text: 'game.main.roulette.elite.prep.actions.teamRocket', fillStyle: 'purple', weight: 1 }
  ];

  onItemSelected(index: number): void {
    switch (index) {
      case 0:
        this.battleTrainerEvent.emit('battle-trainer');
        break;
      case 1:
        this.buyPotionsEvent.emit();
        break;
      case 2:
        this.catchTwoPokemonEvent.emit();
        break;
      case 3:
        this.catchThreePokemonEvent.emit();
        break;
      case 4:
        this.legendaryEncounterEvent.emit();
        break;
      case 5:
        this.findItemEvent.emit();
        break;
      case 6:
        this.teamRocketEncounterEvent.emit();
        break;
      default:
        break;
    }
  }
}
