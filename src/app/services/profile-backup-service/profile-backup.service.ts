import { Injectable } from '@angular/core';
import { PlayerStats } from '../../interfaces/player-stats';
import { PokedexData } from '../../interfaces/pokedex-data';
import { StatsService } from '../stats-service/stats.service';
import { PokedexService } from '../pokedex-service/pokedex.service';

export const PROFILE_BUNDLE_KIND = 'pokemon-roulette-profile';
export const PROFILE_BUNDLE_VERSION = 1;

interface ProfileBundle {
  kind: string;
  bundleVersion: number;
  exportedAt: string;
  stores: {
    stats: { version: number; data: PlayerStats };
    pokedex: { version: number; data: PokedexData };
  };
}

export type ProfileImportResult = 'success' | 'invalid' | 'unsupported-version';

/**
 * Owns the unified profile backup — stats (which already carries
 * achievements, see plan V3 §3 correction) + Pokédex — as a single
 * namespaced JSON bundle. Generalizes V2's stats-only export/import by
 * reusing StatsService's existing exportStats()/importStats() rather than
 * duplicating their normalize/persist logic (plan V3 §6 "generalize, don't
 * fork"). Excludes transient run state and preferences by design (plan §8.1).
 */
@Injectable({ providedIn: 'root' })
export class ProfileBackupService {
  constructor(
    private statsService: StatsService,
    private pokedexService: PokedexService,
  ) {}

  exportProfile(): string {
    const bundle: ProfileBundle = {
      kind: PROFILE_BUNDLE_KIND,
      bundleVersion: PROFILE_BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      stores: {
        stats: { version: this.statsService.current.version, data: this.statsService.current },
        pokedex: { version: this.pokedexService.currentPokedex.version, data: this.pokedexService.currentPokedex },
      },
    };
    return JSON.stringify(bundle, null, 2);
  }

  /**
   * Replaces both stats and Pokédex wholesale from a bundle (plan §8.2:
   * replace-per-store, no merge). Rejects anything that isn't this bundle
   * format — V2's bare stats-only export files are not accepted (plan §8.4).
   * Each store is normalized through its own existing safe-load path, never
   * trusting the blob raw.
   */
  importProfile(json: string): ProfileImportResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return 'invalid';
    }

    if (!parsed || typeof parsed !== 'object') {
      return 'invalid';
    }

    const bundle = parsed as Partial<ProfileBundle>;
    if (bundle.kind !== PROFILE_BUNDLE_KIND) {
      return 'invalid';
    }
    if (typeof bundle.bundleVersion !== 'number' || bundle.bundleVersion > PROFILE_BUNDLE_VERSION) {
      return 'unsupported-version';
    }

    this.statsService.importStats(JSON.stringify(bundle.stores?.stats?.data ?? {}));
    this.pokedexService.replacePokedex(bundle.stores?.pokedex?.data);

    return 'success';
  }
}
