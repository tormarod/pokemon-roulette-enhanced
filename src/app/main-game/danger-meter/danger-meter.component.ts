import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Presentational meter for the New-Experience choose-between adventure's danger cadence. */
@Component({
  selector: 'app-danger-meter',
  imports: [TranslatePipe],
  templateUrl: './danger-meter.component.html',
  styleUrl: './danger-meter.component.css'
})
export class DangerMeterComponent implements OnChanges {
  @Input() dangerPercent = 5;
  @Input() isNextStepGuaranteedSafe = false;

  showReliefCue = false;
  private previousPercent: number | null = null;
  private reliefTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['dangerPercent']) {
      return;
    }
    if (this.previousPercent !== null && this.dangerPercent < this.previousPercent) {
      this.triggerReliefCue();
    }
    this.previousPercent = this.dangerPercent;
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
