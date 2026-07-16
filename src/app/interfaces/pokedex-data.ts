/** Bump when the shape changes; a migration step would need to handle every prior version. */
export const POKEDEX_VERSION = 1;

export interface PokedexEntry {
  won: boolean;
  sprite: string | null;
  shiny?: boolean;
  mega?: boolean;
}

export interface PokedexData {
  version: number;
  caught: Record<string, PokedexEntry>;
}

export function createDefaultPokedexData(): PokedexData {
  return { version: POKEDEX_VERSION, caught: {} };
}

/**
 * Merges a parsed (possibly older or partial) blob onto a fresh default,
 * field by field — mirrors normalizePlayerStats() in player-stats.ts. Drops
 * malformed individual entries rather than discarding the whole Pokédex.
 */
export function normalizePokedexData(value: unknown): PokedexData {
  const defaults = createDefaultPokedexData();
  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const partial = value as Partial<PokedexData>;
  return {
    version: POKEDEX_VERSION,
    caught: caughtRecordOr(partial.caught, defaults.caught),
  };
}

function caughtRecordOr(value: unknown, fallback: Record<string, PokedexEntry>): Record<string, PokedexEntry> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const normalized: Record<string, PokedexEntry> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalizedEntry = normalizePokedexEntry(entry);
    if (normalizedEntry) {
      normalized[key] = normalizedEntry;
    }
  }
  return normalized;
}

function normalizePokedexEntry(value: unknown): PokedexEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Partial<PokedexEntry>;
  return {
    won: Boolean(entry.won),
    sprite: typeof entry.sprite === 'string' ? entry.sprite : null,
    ...(entry.shiny ? { shiny: true } : {}),
    ...(entry.mega ? { mega: true } : {}),
  };
}
