import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { EventPopupComponent } from '../../../../event-popup/event-popup.component';

@Component({
  selector: 'app-team-rocket-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './team-rocket-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './team-rocket-roulette.component.css'
})
export class TeamRocketRouletteComponent implements OnInit {

  constructor(
    private modalService: NgbModal,
    private translateService: TranslateService
  ) {
  }

  @Input() stolenPokemon!: PokemonItem | null;
  @Output() stealPokemonEvent = new EventEmitter<void>();
  @Output() nothingHappensEvent = new EventEmitter<void>();
  @Output() defeatInBattleEvent = new EventEmitter<void>();

  outcomes: WheelItem[] = [];

  jessie = {
    name: 'Jessie',
    sprite: 'https://raw.githubusercontent.com/zeroxm/pokemon-roulette-trainer-sprites/refs/heads/main/sprites/SugimoriJessie.png',
  }

  james = {
    name: 'James',
    sprite: 'https://raw.githubusercontent.com/zeroxm/pokemon-roulette-trainer-sprites/refs/heads/main/sprites/SugimoriJames.png',
  }

  ngOnInit(): void {
    this.outcomes = [
      { text: 'game.main.roulette.teamrocket.outcomes.steal', fillStyle: 'crimson', weight: 2 },
      { text: 'game.main.roulette.teamrocket.outcomes.runAway', fillStyle: 'darkorange', weight: 1 },
    ];

    if (this.stolenPokemon) {
      this.outcomes.push({ text: 'game.main.roulette.teamrocket.outcomes.defeat', fillStyle: 'green', weight: 4 });
    } else {
      this.outcomes.push({ text: 'game.main.roulette.teamrocket.outcomes.defeat', fillStyle: 'green', weight: 2 });
    }

    const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'lg', windowClass: 'event-popup-modal' });
    modalRef.componentInstance.title = this.translateService.instant('game.main.roulette.teamrocket.teamrocket');
    modalRef.componentInstance.images = [
      { src: this.james.sprite, alt: this.james.name },
      { src: this.jessie.sprite, alt: this.jessie.name }
    ];
    modalRef.componentInstance.lines = [
      this.translateService.instant('game.main.roulette.teamrocket.trouble'),
      this.translateService.instant('game.main.roulette.teamrocket.double')
    ];
    modalRef.componentInstance.buttons = [{ label: this.translateService.instant('game.main.roulette.teamrocket.meowth'), variant: 'primary' }];
  }

  onItemSelected(index: number): void {
    switch (index) {
      case 0:
        this.stealPokemonEvent.emit();
        break;
      case 1:
        this.nothingHappensEvent.emit();
        break;
      case 2:
        this.defeatInBattleEvent.emit();
        break;
    }
  }
}
