import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { PendingTypeBiases } from './trainer.service';

/** Honey target-share tuning: single use targets 55% of the wheel; stacking approaches but never reaches 75% (see applyTypeBias()). */
export const HONEY_TARGET_SHARE = 0.55;
export const HONEY_STACK_CAP = 0.75;
export const HONEY_MAX_TYPES = 3;

/**
 * A hard filter that would empty the pool is skipped (falls back to the
 * unfiltered pool) rather than ever soft-locking the wheel. Multiple hard
 * toward entries for different types OR together (widen the guarantee).
 */
export function applyTypeBias(pokemon: PokemonItem[], biases: PendingTypeBiases): PokemonItem[] {
  const { toward, honey } = biases;
  let result = pokemon;

  const hardTowardTypes = new Set(toward.filter(e => e.mode === 'hard').map(e => e.type));

  if (hardTowardTypes.size > 0) {
    const filtered = result.filter(p => matchesAnyType(p, hardTowardTypes));
    if (filtered.length > 0) {
      result = filtered;
    }
  }

  const honeyTypes = new Set(honey.flat());
  const n = honey.length;
  if (n > 0 && honeyTypes.size > 0) {
    const S = HONEY_STACK_CAP * (1 - Math.pow(1 - HONEY_TARGET_SHARE / HONEY_STACK_CAP, n));
    const countK = result.filter(p => matchesAnyType(p, honeyTypes)).length;
    const nonK = result.length - countK;
    if (countK > 0 && nonK > 0) {
      const w = (S / (1 - S)) * (nonK / countK);
      result = result.map(p => matchesAnyType(p, honeyTypes) ? { ...p, weight: w } : p);
    }
  }

  const towardTypes = new Set([...hardTowardTypes, ...honeyTypes]);
  if (towardTypes.size > 0) {
    result = result.map(p => tagBiasVisuals(p, towardTypes));
  }

  return result;
}

/** Tags a Pokémon with the wheel-slice highlight flag (V2 B3) for the currently active toward biases. */
function tagBiasVisuals(pokemon: PokemonItem, towardTypes: Set<PokemonType>): PokemonItem {
  const highlighted = matchesAnyType(pokemon, towardTypes);
  if (!highlighted) {
    return pokemon;
  }
  return { ...pokemon, highlighted };
}

function matchesAnyType(pokemon: PokemonItem, types: Set<PokemonType>): boolean {
  return (pokemon.type1 != null && types.has(pokemon.type1)) || (pokemon.type2 != null && types.has(pokemon.type2));
}
