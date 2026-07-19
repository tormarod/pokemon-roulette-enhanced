import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Observable } from 'rxjs';

export type AdventureStepType = 'reward' | 'threat';

export interface DangerMeterState {
  dangerPercent: number;
  consecutiveThreats: number;
}

const INIT_DANGER_PERCENT = 5;

/**
 * New-Experience-only cadence engine for the choose-between adventure (V2 Part A).
 * Decides whether each adventure step draws from the reward pool or the threat
 * pool, escalating danger over rounds but relieving it after every threat and
 * hard-pitying back to a reward after too many threats in a row.
 */
@Injectable({
  providedIn: 'root'
})
export class DangerMeterService {
  private static readonly BASE = 5;
  private static readonly CURVE = 5;
  private static readonly CAP = 70;
  private static readonly RELIEF = 20;
  private static readonly RECOVERY = 10;
  private static readonly FLOOR = 5;
  private static readonly PITY = 3;
  private static readonly SPIKE = 30;

  private state = new BehaviorSubject<DangerMeterState>({
    dangerPercent: INIT_DANGER_PERCENT,
    consecutiveThreats: 0
  });

  dangerPercent$: Observable<number> = this.state.pipe(
    map(state => state.dangerPercent),
    distinctUntilChanged()
  );

  getStateObservable(): Observable<DangerMeterState> {
    return this.state.asObservable();
  }

  get currentDangerPercent(): number {
    return this.state.value.dangerPercent;
  }

  get currentConsecutiveThreats(): number {
    return this.state.value.consecutiveThreats;
  }

  /** base(round) = min(CAP, BASE + CURVE * round^2) — the ceiling danger recovers up to. */
  private base(round: number): number {
    return Math.min(DangerMeterService.CAP, DangerMeterService.BASE + DangerMeterService.CURVE * round * round);
  }

  private recoverTo(round: number): number {
    return Math.min(this.base(round), this.state.value.dangerPercent + DangerMeterService.RECOVERY);
  }

  /**
   * Rolls the next adventure step. Must be called only when the outcome is
   * about to be committed (drawing the 3 candidates), never as a preview —
   * this is the committed action, mirroring PendingSpinService.
   */
  rollStep(round: number): AdventureStepType {
    const current = this.state.value;

    if (current.consecutiveThreats >= DangerMeterService.PITY) {
      this.state.next({ dangerPercent: this.recoverTo(round), consecutiveThreats: 0 });
      return 'reward';
    }

    const isThreat = Math.random() * 100 < current.dangerPercent;
    if (isThreat) {
      this.state.next({
        dangerPercent: Math.max(DangerMeterService.FLOOR, current.dangerPercent - DangerMeterService.RELIEF),
        consecutiveThreats: current.consecutiveThreats + 1
      });
      return 'threat';
    }

    this.state.next({ dangerPercent: this.recoverTo(round), consecutiveThreats: 0 });
    return 'reward';
  }

  /** "Spooked" threat: undoes most of rollStep's automatic threat relief. Not capped by base(round) — a punishment, not a recovery. */
  applySpike(): void {
    const current = this.state.value;
    this.state.next({
      dangerPercent: Math.min(100, current.dangerPercent + DangerMeterService.SPIKE),
      consecutiveThreats: current.consecutiveThreats
    });
  }

  /** True once a forced-safe reward is guaranteed on the next roll (for the UI's shielded state). */
  isNextStepGuaranteedSafe(): boolean {
    return this.state.value.consecutiveThreats >= DangerMeterService.PITY - 1;
  }

  resetForNewRun(): void {
    this.state.next({ dangerPercent: INIT_DANGER_PERCENT, consecutiveThreats: 0 });
  }

  restore(dangerPercent: number, consecutiveThreats: number): void {
    this.state.next({ dangerPercent, consecutiveThreats });
  }
}
