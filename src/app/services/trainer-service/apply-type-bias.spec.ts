import { applyTypeBias } from './apply-type-bias';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PendingTypeBiases } from './trainer.service';

describe('applyTypeBias', () => {
  const pokemon: PokemonItem[] = [
    { pokemonId: 1, text: 'pokemon.bulbasaur', fillStyle: 'green', sprite: null, shiny: false, power: 1, weight: 1, type1: 'grass', type2: 'poison' },
    { pokemonId: 4, text: 'pokemon.charmander', fillStyle: 'red', sprite: null, shiny: false, power: 1, weight: 1, type1: 'fire', type2: null },
    { pokemonId: 7, text: 'pokemon.squirtle', fillStyle: 'blue', sprite: null, shiny: false, power: 1, weight: 1, type1: 'water', type2: null }
  ];

  const noBias: PendingTypeBiases = { toward: null, away: null };

  it('passes the pool through unchanged when no bias is active', () => {
    expect(applyTypeBias(pokemon, noBias)).toEqual(pokemon);
  });

  it('hard-filters to matching type for a toward bias', () => {
    const biases: PendingTypeBiases = { toward: { type: 'fire', mode: 'hard' }, away: null };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([4]);
  });

  it('hard-filters out matching type for an away bias', () => {
    const biases: PendingTypeBiases = { toward: null, away: { type: 'fire', mode: 'hard' } };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([1, 7]);
  });

  it('combines hard toward and hard away filters', () => {
    const biases: PendingTypeBiases = {
      toward: { type: 'water', mode: 'hard' },
      away: { type: 'fire', mode: 'hard' }
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([7]);
  });

  it('falls back to the unfiltered pool when a hard filter would empty it', () => {
    const biases: PendingTypeBiases = { toward: { type: 'electric', mode: 'hard' }, away: null };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([1, 4, 7]);
  });

  it('boosts weight of matching pokemon for a soft toward bias', () => {
    const biases: PendingTypeBiases = { toward: { type: 'fire', mode: 'soft' }, away: null };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(4);
    expect(result.find(p => p.pokemonId === 1)!.weight).toBe(1);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(1);
  });

  it('reduces weight of matching pokemon for a soft away bias', () => {
    const biases: PendingTypeBiases = { toward: null, away: { type: 'fire', mode: 'soft' } };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(0.25);
    expect(result.find(p => p.pokemonId === 1)!.weight).toBe(1);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(1);
  });

  it('combines soft toward and soft away weight adjustments', () => {
    const biases: PendingTypeBiases = {
      toward: { type: 'water', mode: 'soft' },
      away: { type: 'fire', mode: 'soft' }
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(4);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(0.25);
    expect(result.find(p => p.pokemonId === 1)!.weight).toBe(1);
  });
});
