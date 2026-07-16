import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbToast } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { StatsService } from '../services/stats-service/stats.service';
import { Achievement } from '../interfaces/achievement';

const TOAST_DELAY_MS = 5000;

/**
 * App-root-mounted toast queue for newly-unlocked achievements (plan V2 §7.2).
 * Subscribes once for the whole app session so an unlock fires a toast no
 * matter which screen is showing. Shows one achievement at a time, queuing
 * the rest — unlocks can arrive in a burst (e.g. several thresholds crossed
 * by the same recordRunEnd mutation).
 */
@Component({
  selector: 'app-achievement-toast',
  imports: [CommonModule, NgbToast, TranslatePipe],
  templateUrl: './achievement-toast.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './achievement-toast.component.css'
})
export class AchievementToastComponent implements OnInit, OnDestroy {

  queue: Achievement[] = [];
  current: Achievement | null = null;

  private subscription: Subscription | null = null;

  constructor(private statsService: StatsService) {}

  ngOnInit(): void {
    this.subscription = this.statsService.getAchievementUnlockedObservable().subscribe(achievement => {
      this.queue.push(achievement);
      this.showNextIfIdle();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  dismiss(): void {
    this.current = null;
    this.showNextIfIdle();
  }

  private showNextIfIdle(): void {
    if (this.current === null && this.queue.length > 0) {
      this.current = this.queue.shift()!;
    }
  }

  readonly toastDelayMs = TOAST_DELAY_MS;
}
