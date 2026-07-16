import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { PendingTypeBiases, TypeBiasEntry } from './trainer.service';

const TOWARD_SOFT_WEIGHT_MULTIPLIER = 4;
const AWAY_SOFT_WEIGHT_MULTIPLIER = 0.25;

/**
 * A hard filter that would empty the pool is skipped (falls back to the
 * unfiltered pool) rather than ever soft-locking the wheel.
 */
export function applyTypeBias(pokemon: PokemonItem[], biases: PendingTypeBiases): PokemonItem[] {
  const { toward, away } = biases;
  let result = pokemon;

  if (toward?.mode === 'hard') {
    const filtered = result.filter(p => matchesType(p, toward.type));
    if (filtered.length > 0) {
      result = filtered;
    }
  }
  if (away?.mode === 'hard') {
    const filtered = result.filter(p => !matchesType(p, away.type));
    if (filtered.length > 0) {
      result = filtered;
    }
  }

  if (toward?.mode === 'soft' || away?.mode === 'soft') {
    result = result.map(p => applySoftWeight(p, toward, away));
  }

  return result;
}

function applySoftWeight(pokemon: PokemonItem, toward: TypeBiasEntry | null, away: TypeBiasEntry | null): PokemonItem {
  let weight = pokemon.weight;
  if (toward?.mode === 'soft' && matchesType(pokemon, toward.type)) {
    weight *= TOWARD_SOFT_WEIGHT_MULTIPLIER;
  }
  if (away?.mode === 'soft' && matchesType(pokemon, away.type)) {
    weight *= AWAY_SOFT_WEIGHT_MULTIPLIER;
  }
  return weight === pokemon.weight ? pokemon : { ...pokemon, weight };
}

function matchesType(pokemon: PokemonItem, type: PokemonType): boolean {
  return pokemon.type1 === type || pokemon.type2 === type;
}
