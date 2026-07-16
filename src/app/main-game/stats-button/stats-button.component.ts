import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NgIconsModule } from '@ng-icons/core';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-stats-button',
  imports: [
    NgIconsModule,
    TranslatePipe
  ],
  templateUrl: './stats-button.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './stats-button.component.css'
})
export class StatsButtonComponent {

  constructor(private router: Router,
              private gameStateService: GameStateService) {
    this.gameStateService.wheelSpinningObserver.pipe(takeUntilDestroyed()).subscribe(state => {
      this.wheelSpinning = state;
    });
  }

  wheelSpinning: boolean = false;

  goToStats(): void {
    if (this.wheelSpinning) {
      return;
    }
    this.router.navigate(['stats']);
  }
}
