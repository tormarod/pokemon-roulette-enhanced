import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { PendingTypeBiases, TypeBiasEntry } from './trainer.service';

const TOWARD_SOFT_BASE_MULTIPLIER = 4;
const AWAY_SOFT_BASE_MULTIPLIER = 0.25;

/**
 * A hard filter that would empty the pool is skipped (falls back to the
 * unfiltered pool) rather than ever soft-locking the wheel. Multiple hard
 * entries for different types OR together (widen the guarantee); multiple
 * soft entries for the same type multiply together (stack the boost).
 */
export function applyTypeBias(pokemon: PokemonItem[], biases: PendingTypeBiases): PokemonItem[] {
  const { toward, away } = biases;
  let result = pokemon;

  const hardTowardTypes = new Set(toward.filter(e => e.mode === 'hard').map(e => e.type));
  const hardAwayTypes = new Set(away.filter(e => e.mode === 'hard').map(e => e.type));

  if (hardTowardTypes.size > 0) {
    const filtered = result.filter(p => matchesAnyType(p, hardTowardTypes));
    if (filtered.length > 0) {
      result = filtered;
    }
  }
  if (hardAwayTypes.size > 0) {
    const filtered = result.filter(p => !matchesAnyType(p, hardAwayTypes));
    if (filtered.length > 0) {
      result = filtered;
    }
  }

  const towardSoftCounts = countByType(toward.filter(e => e.mode === 'soft'));
  const awaySoftCounts = countByType(away.filter(e => e.mode === 'soft'));

  if (towardSoftCounts.size > 0 || awaySoftCounts.size > 0) {
    result = result.map(p => applySoftWeight(p, towardSoftCounts, awaySoftCounts));
  }

  return result;
}

function countByType(entries: TypeBiasEntry[]): Map<PokemonType, number> {
  const counts = new Map<PokemonType, number>();
  for (const entry of entries) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  }
  return counts;
}

function applySoftWeight(
  pokemon: PokemonItem,
  towardCounts: Map<PokemonType, number>,
  awayCounts: Map<PokemonType, number>
): PokemonItem {
  let weight = pokemon.weight;
  weight *= softMultiplier(pokemon, towardCounts, TOWARD_SOFT_BASE_MULTIPLIER, true);
  weight *= softMultiplier(pokemon, awayCounts, AWAY_SOFT_BASE_MULTIPLIER, false);
  return weight === pokemon.weight ? pokemon : { ...pokemon, weight };
}

function softMultiplier(
  pokemon: PokemonItem,
  counts: Map<PokemonType, number>,
  base: number,
  toward: boolean
): number {
  let multiplier = 1;
  for (const [type, n] of counts) {
    if (!matchesType(pokemon, type)) continue;
    multiplier *= toward ? base * n : base / n;
  }
  return multiplier;
}

function matchesType(pokemon: PokemonItem, type: PokemonType): boolean {
  return pokemon.type1 === type || pokemon.type2 === type;
}

function matchesAnyType(pokemon: PokemonItem, types: Set<PokemonType>): boolean {
  return (pokemon.type1 != null && types.has(pokemon.type1)) || (pokemon.type2 != null && types.has(pokemon.type2));
}
