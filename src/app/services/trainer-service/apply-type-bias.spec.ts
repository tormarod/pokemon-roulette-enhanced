import { applyTypeBias, TOWARD_SOFT_BASE_MULTIPLIER, AWAY_SOFT_BASE_MULTIPLIER } from './apply-type-bias';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PendingTypeBiases } from './trainer.service';

describe('applyTypeBias', () => {
  const pokemon: PokemonItem[] = [
    { pokemonId: 1, text: 'pokemon.bulbasaur', fillStyle: 'green', sprite: null, shiny: false, power: 1, weight: 1, type1: 'grass', type2: 'poison' },
    { pokemonId: 4, text: 'pokemon.charmander', fillStyle: 'red', sprite: null, shiny: false, power: 1, weight: 1, type1: 'fire', type2: null },
    { pokemonId: 7, text: 'pokemon.squirtle', fillStyle: 'blue', sprite: null, shiny: false, power: 1, weight: 1, type1: 'water', type2: null }
  ];

  const dualTypePokemon: PokemonItem[] = [
    { pokemonId: 181, text: 'pokemon.ampharos', fillStyle: 'yellow', sprite: null, shiny: false, power: 1, weight: 1, type1: 'electric', type2: null },
    { pokemonId: 184, text: 'pokemon.azumarill', fillStyle: 'blue', sprite: null, shiny: false, power: 1, weight: 1, type1: 'water', type2: null },
    { pokemonId: 999, text: 'pokemon.electric-water', fillStyle: 'teal', sprite: null, shiny: false, power: 1, weight: 1, type1: 'electric', type2: 'water' }
  ];

  const noBias: PendingTypeBiases = { toward: [], away: [] };

  it('passes the pool through unchanged when no bias is active', () => {
    expect(applyTypeBias(pokemon, noBias)).toEqual(pokemon);
  });

  it('hard-filters to matching type for a toward bias', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'fire', mode: 'hard' }], away: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([4]);
  });

  it('hard-filters out matching type for an away bias', () => {
    const biases: PendingTypeBiases = { toward: [], away: [{ type: 'fire', mode: 'hard' }] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([1, 7]);
  });

  it('combines hard toward and hard away filters', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'water', mode: 'hard' }],
      away: [{ type: 'fire', mode: 'hard' }]
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([7]);
  });

  it('falls back to the unfiltered pool when a hard filter would empty it', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'electric', mode: 'hard' }], away: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([1, 4, 7]);
  });

  it('boosts weight of matching pokemon for a soft toward bias', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'fire', mode: 'soft' }], away: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 1)!.weight).toBe(1);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(1);
  });

  it('reduces weight of matching pokemon for a soft away bias', () => {
    const biases: PendingTypeBiases = { toward: [], away: [{ type: 'fire', mode: 'soft' }] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 1)!.weight).toBe(1);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(1);
  });

  it('combines soft toward and soft away weight adjustments on different types', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'water', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }]
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 1)!.weight).toBe(1);
  });

  it('stacks two soft-toward uses of the same type linearly (base x n)', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }],
      away: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER * 2);
  });

  it('stacks two soft-away uses of the same type linearly (base / n)', () => {
    const biases: PendingTypeBiases = {
      toward: [],
      away: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }]
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER / 2);
  });

  it('applies two different soft-toward types independently, multiplying together for a dual-type match', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'electric', mode: 'soft' }, { type: 'water', mode: 'soft' }],
      away: []
    };
    const result = applyTypeBias(dualTypePokemon, biases);
    expect(result.find(p => p.pokemonId === 181)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 184)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 999)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER * TOWARD_SOFT_BASE_MULTIPLIER);
  });

  it('ORs multiple hard-toward types instead of intersecting them', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'hard' }, { type: 'water', mode: 'hard' }],
      away: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId).sort()).toEqual([4, 7]);
  });

  it('treats a repeated hard-toward use of the same type as a no-op (Set dedupes)', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'hard' }, { type: 'fire', mode: 'hard' }],
      away: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([4]);
  });

  // ── Same-type toward/away cancellation ─────────────────────────────────
  // A Honey and a Repel on the SAME type are a direct contradiction and
  // should cancel out entirely, rather than leaving it to the weight math
  // (which only nets to neutral if the two constants happen to be exact
  // reciprocals of each other).

  it('fully cancels a single soft-toward and single soft-away use on the same type', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }]
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(1);
  });

  it('cancels equal-count stacks on the same type, regardless of stack size', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }]
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(1);
  });

  it('leaves only the uncancelled excess in effect when counts differ on the same type', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }]
    };
    const result = applyTypeBias(pokemon, biases);
    // 3 toward - 1 away cancelled = 2 net toward uses.
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER * 2);
  });

  it('leaves only the uncancelled excess on the away side when it outnumbers toward', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }]
    };
    const result = applyTypeBias(pokemon, biases);
    // 3 away - 1 toward cancelled = 2 net away uses.
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER / 2);
  });

  it('does not cancel toward/away uses on different types', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'water', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }]
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER);
  });

  it('does not cancel hard-mode entries on the same type', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'hard' }],
      away: [{ type: 'fire', mode: 'hard' }]
    };
    const result = applyTypeBias(pokemon, biases);
    // Hard-toward filters to Fire only, then hard-away would filter Fire out —
    // which would empty the pool, so the away filter is skipped (see the
    // "falls back to the unfiltered pool" behavior); Fire remains selected.
    expect(result.map(p => p.pokemonId)).toEqual([4]);
  });
});
