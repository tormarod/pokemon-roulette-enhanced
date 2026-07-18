import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AdventureStepType } from '../danger-meter-service/danger-meter.service';

export interface PendingAdventureDraw {
  stepType: AdventureStepType;
  candidates: string[];
  picked: number | null;
}

/**
 * Holds the New-Experience choose-between adventure draw (3 drawn candidate
 * ids) from the moment they're shown until the player picks one. Anti-reroll,
 * same shape as BattlePrepService/PendingSpinService: commit the draw the
 * instant it's shown (so a reload can't re-draw for better options), commit
 * the pick the instant it's made (so a reload can't change the pick).
 */
@Injectable({
  providedIn: 'root'
})
export class AdventureDrawService {
  private pendingDraw = new BehaviorSubject<PendingAdventureDraw | null>(null);

  getPendingDrawObservable(): Observable<PendingAdventureDraw | null> {
    return this.pendingDraw.asObservable();
  }

  /** Synchronous read for a component that mounts and finds a draw already committed. */
  getPendingDraw(): PendingAdventureDraw | null {
    return this.pendingDraw.value;
  }

  commitDraw(stepType: AdventureStepType, candidates: string[]): void {
    this.pendingDraw.next({ stepType, candidates, picked: null });
  }

  commitPick(pickedIndex: number): void {
    const current = this.pendingDraw.value;
    if (!current) {
      return;
    }
    this.pendingDraw.next({ ...current, picked: pickedIndex });
  }

  /** Called once the picked outcome has been routed, so it can't leak into the next step. */
  clearDraw(): void {
    this.pendingDraw.next(null);
  }

  restoreDraw(draw: PendingAdventureDraw | null): void {
    this.pendingDraw.next(draw);
  }
}
