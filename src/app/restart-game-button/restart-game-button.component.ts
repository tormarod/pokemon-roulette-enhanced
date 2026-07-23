import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import { bootstrapArrowRepeat } from '@ng-icons/bootstrap-icons';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EventPopupComponent } from '../event-popup/event-popup.component';

@Component({
  selector: 'app-restart-game-button',
  imports: [
    NgIconsModule,
    TranslatePipe
  ],
  providers: [
    provideIcons({ bootstrapArrowRepeat })
  ],
  templateUrl: './restart-game-button.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './restart-game-button.component.css'
})
export class RestartGameButtonComponent {

  constructor(private modalService: NgbModal,
              private gameStateService: GameStateService,
              private translate: TranslateService
  ) {
    this.gameStateService.wheelSpinningObserver.pipe(takeUntilDestroyed()).subscribe(state => {
      this.wheelSpinning = state;
    });
  }

  wheelSpinning: boolean = false;
  @Output() restartEvent = new EventEmitter<boolean>();

  showRestartGameConfirmModal(): void {
    if (this.wheelSpinning) {
      return;
    }
    const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'lg', windowClass: 'event-popup-modal' });
    modalRef.componentInstance.title = this.translate.instant('game.restart.title');
    modalRef.componentInstance.lines = [this.translate.instant('game.restart.warning')];
    modalRef.componentInstance.buttons = [
      { label: this.translate.instant('game.restart.confirm'), variant: 'primary' },
      { label: this.translate.instant('game.restart.cancel'), variant: 'secondary' }
    ];
    modalRef.result.then((index: number) => {
      if (index === 0) {
        this.confirmRestart();
      }
    }, () => {});
  }

  confirmRestart(): void {
    this.restartEvent.emit(true);
  }
}
