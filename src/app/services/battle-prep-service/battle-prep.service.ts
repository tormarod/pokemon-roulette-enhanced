import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TrainerService } from '../trainer-service/trainer.service';

export interface PendingBattlePrep {
  battleKey: string;       // e.g. 'gym-battle', 'battle-rival', 'elite-four-battle', 'champion-battle'
  leadIndex: number;       // index into trainerTeam at the moment of commit
  xAttackUsed: boolean;
}

/**
 * Holds the New-Experience pre-battle draft (lead pick + item use) once the
 * player hits Confirm. Depends on TrainerService directly — unlike
 * PendingSpinService, which stays dependency-free only because WheelComponent
 * is shared by every wheel in the app; this service is battle-specific, so no
 * such constraint applies.
 */
@Injectable({
  providedIn: 'root'
})
export class BattlePrepService {
  private pendingBattlePrep = new BehaviorSubject<PendingBattlePrep | null>(null);

  constructor(private trainerService: TrainerService) {}

  getPendingPrepObservable(): Observable<PendingBattlePrep | null> {
    return this.pendingBattlePrep.asObservable();
  }

  /** Synchronous read for a battle component that mounts and finds a prep already committed. */
  getPendingPrep(): PendingBattlePrep | null {
    return this.pendingBattlePrep.value;
  }

  /**
   * The only mutating entry point. Consumes the committed x-attack from
   * inventory (potion consumption stays in the battle component, via the
   * existing `usePotion`, since that needs the component's modal-opener
   * callback) and persists the draft immediately — anti-reroll, same as
   * PendingSpinService.
   */
  commitPrep(prep: PendingBattlePrep): void {
    if (prep.xAttackUsed) {
      const xAttack = this.trainerService.getItems().find(item => item.name === 'x-attack');
      if (xAttack) {
        this.trainerService.removeItem(xAttack);
      }
    }
    this.pendingBattlePrep.next(prep);
  }

  /** Called once the battle result is known so a finished battle's prep can't leak into the next one. */
  clearPrep(): void {
    this.pendingBattlePrep.next(null);
  }

  restorePrep(prep: PendingBattlePrep | null): void {
    this.pendingBattlePrep.next(prep);
  }
}
