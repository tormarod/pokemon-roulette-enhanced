import { Injectable } from '@angular/core';

/**
 * Deliberately dependency-free (no TrainerService/GameStateService) so WheelComponent
 * — shared by every wheel in the app — doesn't drag in the whole run-persistence
 * dependency chain just to guard against the reload-mid-spin exploit.
 */
@Injectable({
  providedIn: 'root'
})
export class PendingSpinService {
  private readonly STORAGE_KEY = 'pokemon-roulette-pending-spin';

  /** Commits the winning item's text the instant a spin's outcome is decided,
   * before the (multi-second) reveal animation plays — so a reload mid-animation
   * can't dodge an already-determined result. */
  commitPendingSpin(winningText: string): void {
    localStorage.setItem(this.STORAGE_KEY, winningText);
  }

  clearPendingSpin(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /** Reads and clears the pending spin in one call, so it can only ever be resolved once. */
  consumePendingSpin(): string | null {
    const pending = localStorage.getItem(this.STORAGE_KEY);
    if (pending !== null) {
      this.clearPendingSpin();
    }
    return pending;
  }
}
