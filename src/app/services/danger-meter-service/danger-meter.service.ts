import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Observable } from 'rxjs';

export type AdventureStepType = 'reward' | 'threat';

export interface DangerMeterState {
  dangerPercent: number;
  consecutiveThreats: number;
  /**
   * Extra adventure steps granted by a reward (currently only `multitask`) that
   * are guaranteed threat-free — a reward that hands you more picks shouldn't be
   * the thing that ambushes you. Each of these steps still advances the danger
   * meter (it keeps climbing), it just can't roll a threat. Decremented one per
   * step in rollStep; persisted so a reload mid-burst can't leak a threat in.
   */
  guaranteedRewardSteps: number;
  /**
   * Player-triggered threat shields from Repel/Max Repel. Unlike
   * `guaranteedRewardSteps`, a shielded step is delay-only: it skips the
   * threat and lets danger climb toward `base(round)` but never cools it —
   * a spike is never refunded.
   */
  shieldedSteps: number;
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
  private static readonly RECOVERY = 15;
  private static readonly FLOOR = 5;
  private static readonly PITY = 3;
  private static readonly SPIKE = 30;

  private state = new BehaviorSubject<DangerMeterState>({
    dangerPercent: INIT_DANGER_PERCENT,
    consecutiveThreats: 0,
    guaranteedRewardSteps: 0,
    shieldedSteps: 0
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

  get currentGuaranteedRewardSteps(): number {
    return this.state.value.guaranteedRewardSteps;
  }

  get currentShieldedSteps(): number {
    return this.state.value.shieldedSteps;
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

    // Player-triggered threat shield (Repel/Max Repel). Consume one and skip
    // the threat roll entirely. Delay-only: danger still climbs toward
    // base(round), but Math.max ensures it is never lowered — a spike is
    // never refunded by walking past an encounter.
    if (current.shieldedSteps > 0) {
      this.state.next({
        dangerPercent: Math.max(current.dangerPercent, this.recoverTo(round)),
        consecutiveThreats: 0,
        guaranteedRewardSteps: current.guaranteedRewardSteps,
        shieldedSteps: current.shieldedSteps - 1
      });
      return 'reward';
    }

    // Guaranteed threat-free step (granted by multitask). Consume one and skip
    // the threat roll entirely, but still recover danger so the meter keeps
    // climbing through the burst.
    if (current.guaranteedRewardSteps > 0) {
      this.state.next({
        dangerPercent: this.recoverTo(round),
        consecutiveThreats: 0,
        guaranteedRewardSteps: current.guaranteedRewardSteps - 1,
        shieldedSteps: 0
      });
      return 'reward';
    }

    if (current.consecutiveThreats >= DangerMeterService.PITY) {
      this.state.next({ dangerPercent: this.recoverTo(round), consecutiveThreats: 0, guaranteedRewardSteps: 0, shieldedSteps: 0 });
      return 'reward';
    }

    const isThreat = Math.random() * 100 < current.dangerPercent;
    if (isThreat) {
      this.state.next({
        dangerPercent: Math.max(DangerMeterService.FLOOR, current.dangerPercent - DangerMeterService.RELIEF),
        consecutiveThreats: current.consecutiveThreats + 1,
        guaranteedRewardSteps: 0,
        shieldedSteps: 0
      });
      return 'threat';
    }

    this.state.next({ dangerPercent: this.recoverTo(round), consecutiveThreats: 0, guaranteedRewardSteps: 0, shieldedSteps: 0 });
    return 'reward';
  }

  /**
   * Grants `count` guaranteed threat-free adventure steps (called when the
   * `multitask` reward queues extra picks). Additive, so overlapping bursts
   * (drawing multitask again during a multitask burst) stack correctly.
   */
  addGuaranteedRewardSteps(count: number): void {
    const current = this.state.value;
    this.state.next({ ...current, guaranteedRewardSteps: current.guaranteedRewardSteps + count });
  }

  /**
   * Grants `count` player-triggered threat shields (Repel/Max Repel). Additive,
   * so using Repel again while one is still active stacks the remaining count.
   */
  addThreatShield(count: number): void {
    const current = this.state.value;
    this.state.next({ ...current, shieldedSteps: current.shieldedSteps + count });
  }

  /**
   * "Spooked" threat: undoes most of rollStep's automatic threat relief. Not capped by
   * base(round) — a punishment, not a recovery. `amount` lets other threats (e.g. `tollBooth`'s
   * overdraft) request a smaller spike than the default.
   */
  applySpike(amount: number = DangerMeterService.SPIKE): void {
    const current = this.state.value;
    this.state.next({
      dangerPercent: Math.min(100, current.dangerPercent + amount),
      consecutiveThreats: current.consecutiveThreats,
      guaranteedRewardSteps: current.guaranteedRewardSteps,
      shieldedSteps: current.shieldedSteps
    });
  }

  /**
   * True once the next roll can't be a threat (for the UI's shielded state):
   * either the hard pity is about to trigger, a multitask burst has queued
   * guaranteed threat-free steps, or a Repel/Max Repel shield is active.
   */
  isNextStepGuaranteedSafe(): boolean {
    const current = this.state.value;
    return (
      current.shieldedSteps > 0 ||
      current.guaranteedRewardSteps > 0 ||
      current.consecutiveThreats >= DangerMeterService.PITY - 1
    );
  }

  resetForNewRun(): void {
    this.state.next({ dangerPercent: INIT_DANGER_PERCENT, consecutiveThreats: 0, guaranteedRewardSteps: 0, shieldedSteps: 0 });
  }

  restore(dangerPercent: number, consecutiveThreats: number, guaranteedRewardSteps = 0, shieldedSteps = 0): void {
    this.state.next({ dangerPercent, consecutiveThreats, guaranteedRewardSteps, shieldedSteps });
  }
}
