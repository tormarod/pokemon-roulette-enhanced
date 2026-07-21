import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PokemonType } from '../../interfaces/pokemon-type';

/**
 * Holds the New-Experience "scouting report" threat's pending extra opponent type —
 * appended to the next real battle's opponentTypes, then cleared once that battle
 * resolves. Chosen at draw time from the player's strongest Pokémon (team + PC).
 * Persisted so a reload can't shake it off.
 */
@Injectable({ providedIn: 'root' })
export class ScoutingReportService {
  private pendingType = new BehaviorSubject<PokemonType | null>(null);

  getPendingTypeObservable(): Observable<PokemonType | null> {
    return this.pendingType.asObservable();
  }

  get currentType(): PokemonType | null {
    return this.pendingType.value;
  }

  setType(type: PokemonType): void {
    this.pendingType.next(type);
  }

  clearType(): void {
    this.pendingType.next(null);
  }

  restoreType(type: PokemonType | null): void {
    this.pendingType.next(type);
  }
}
