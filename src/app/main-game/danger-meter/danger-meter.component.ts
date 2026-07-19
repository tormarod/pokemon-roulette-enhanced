import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { DangerMeterService } from '../../services/danger-meter-service/danger-meter.service';

/**
 * Self-sufficient meter for the New-Experience danger cadence. Reads
 * DangerMeterService directly (it's a singleton) instead of taking inputs,
 * so any parent can render it persistently without wiring up its own
 * subscription.
 */
@Component({
  selector: 'app-danger-meter',
  imports: [TranslatePipe, NgbTooltipModule],
  templateUrl: './danger-meter.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './danger-meter.component.css'
})
export class DangerMeterComponent implements OnInit, OnDestroy {
  dangerPercent = 5;
  isNextStepGuaranteedSafe = false;
  showReliefCue = false;

  private previousPercent: number | null = null;
  private reliefTimeout: ReturnType<typeof setTimeout> | null = null;
  private dangerSubscription: Subscription | null = null;

  constructor(private dangerMeterService: DangerMeterService) {
  }

  ngOnInit(): void {
    this.dangerSubscription = this.dangerMeterService.dangerPercent$.subscribe(percent => {
      if (this.previousPercent !== null && percent < this.previousPercent) {
        this.triggerReliefCue();
      }
      this.previousPercent = percent;
      this.dangerPercent = percent;
      this.isNextStepGuaranteedSafe = this.dangerMeterService.isNextStepGuaranteedSafe();
    });
  }

  ngOnDestroy(): void {
    this.dangerSubscription?.unsubscribe();
    if (this.reliefTimeout) {
      clearTimeout(this.reliefTimeout);
    }
  }

  get colorClass(): string {
    if (this.dangerPercent >= 60) {
      return 'danger-high';
    }
    if (this.dangerPercent >= 30) {
      return 'danger-medium';
    }
    return 'danger-low';
  }

  private triggerReliefCue(): void {
    this.showReliefCue = true;
    if (this.reliefTimeout) {
      clearTimeout(this.reliefTimeout);
    }
    this.reliefTimeout = setTimeout(() => {
      this.showReliefCue = false;
    }, 3000);
  }
}
