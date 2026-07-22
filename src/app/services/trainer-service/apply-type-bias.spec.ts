import { applyTypeBias, HONEY_TARGET_SHARE, HONEY_STACK_CAP } from './apply-type-bias';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PendingTypeBiases } from './trainer.service';
import { PokemonType } from '../../interfaces/pokemon-type';

describe('applyTypeBias', () => {
  const pokemon: PokemonItem[] = [
    { pokemonId: 1, text: 'pokemon.bulbasaur', fillStyle: 'green', sprite: null, shiny: false, power: 1, weight: 1, type1: 'grass', type2: 'poison' },
    { pokemonId: 4, text: 'pokemon.charmander', fillStyle: 'red', sprite: null, shiny: false, power: 1, weight: 1, type1: 'fire', type2: null },
    { pokemonId: 7, text: 'pokemon.squirtle', fillStyle: 'blue', sprite: null, shiny: false, power: 1, weight: 1, type1: 'water', type2: null }
  ];

  const noBias: PendingTypeBiases = { toward: [], honey: [] };

  /** Builds a pool of `total` mons where exactly `fireCount` are pure Fire and the rest are pure Water. */
  function makePool(total: number, fireCount: number): PokemonItem[] {
    const pool: PokemonItem[] = [];
    for (let i = 0; i < total; i++) {
      const isFire = i < fireCount;
      pool.push({
        pokemonId: i,
        text: `pokemon.${i}`,
        fillStyle: isFire ? 'red' : 'blue',
        sprite: null,
        shiny: false,
        power: 1,
        weight: 1,
        type1: isFire ? 'fire' : 'water',
        type2: null
      });
    }
    return pool;
  }

  function setShareOf(result: PokemonItem[], types: Set<PokemonType>): number {
    const totalWeight = result.reduce((sum, p) => sum + p.weight, 0);
    const kWeight = result.filter(p => p.type1 != null && types.has(p.type1)).reduce((sum, p) => sum + p.weight, 0);
    return kWeight / totalWeight;
  }

  it('passes the pool through unchanged when no bias is active', () => {
    expect(applyTypeBias(pokemon, noBias)).toEqual(pokemon);
  });

  it('hard-filters to matching type for a toward bias', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'fire', mode: 'hard' }], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([4]);
  });

  it('falls back to the unfiltered pool when a hard filter would empty it', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'electric', mode: 'hard' }], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([1, 4, 7]);
  });

  it('ORs multiple hard-toward types instead of intersecting them', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'hard' }, { type: 'water', mode: 'hard' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId).sort()).toEqual([4, 7]);
  });

  it('treats a repeated hard-toward use of the same type as a no-op (Set dedupes)', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'hard' }, { type: 'fire', mode: 'hard' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([4]);
  });

  // ── V2 B3: wheel-slice highlight visual tagging ────────────────────────

  it('tags matching items as highlighted for a hard toward bias', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'fire', mode: 'hard' }], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.every(p => p.highlighted)).toBeTrue();
  });

  it('does not tag anything when no bias is active', () => {
    const result = applyTypeBias(pokemon, noBias);
    expect(result.every(p => !p.highlighted)).toBeTrue();
  });

  // ── Honey target-share ──────────────────────────────────────────────────

  it('a single Honey use holds the chosen type at ~55% of the wheel regardless of pool size', () => {
    const smallPool = makePool(20, 3);
    const largePool = makePool(100, 8);
    const biases: PendingTypeBiases = { toward: [], honey: [['fire']] };

    const smallResult = applyTypeBias(smallPool, biases);
    const largeResult = applyTypeBias(largePool, biases);

    expect(setShareOf(smallResult, new Set(['fire']))).toBeCloseTo(HONEY_TARGET_SHARE, 6);
    expect(setShareOf(largeResult, new Set(['fire']))).toBeCloseTo(HONEY_TARGET_SHARE, 6);
  });

  it('two Honey uses on different types push the combined set share toward ~70%', () => {
    // A third, un-targeted type (grass) is required so the K/non-K split is meaningful —
    // a pool made only of the two Honey-targeted types has no non-K remainder to redistribute from.
    const pool: PokemonItem[] = [
      ...makePool(20, 10), // 10 fire, 10 water
      ...Array.from({ length: 30 }, (_, i) => ({
        pokemonId: 1000 + i, text: `pokemon.grass${i}`, fillStyle: 'green', sprite: null,
        shiny: false, power: 1, weight: 1, type1: 'grass', type2: null
      } as PokemonItem))
    ];
    const biases: PendingTypeBiases = { toward: [], honey: [['fire'], ['water']] };

    const result = applyTypeBias(pool, biases);

    const expectedShare = HONEY_STACK_CAP * (1 - Math.pow(1 - HONEY_TARGET_SHARE / HONEY_STACK_CAP, 2));
    expect(setShareOf(result, new Set(['fire', 'water']))).toBeCloseTo(expectedShare, 6);
    expect(expectedShare).toBeCloseTo(0.697, 2);
  });

  it('never lets stacked Honey uses push the set share above the 75% ceiling', () => {
    const pool = makePool(60, 5);
    const honeyUses: PokemonType[][] = Array.from({ length: 8 }, () => ['fire']);
    const biases: PendingTypeBiases = { toward: [], honey: honeyUses };

    const result = applyTypeBias(pool, biases);

    expect(setShareOf(result, new Set(['fire']))).toBeLessThanOrEqual(HONEY_STACK_CAP + 1e-9);
    expect(setShareOf(result, new Set(['fire']))).toBeCloseTo(HONEY_STACK_CAP, 2);
  });

  it('is a no-op when the Honey type is entirely absent from the pool', () => {
    const biases: PendingTypeBiases = { toward: [], honey: [['electric']] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.every(p => p.weight === 1)).toBeTrue();
  });

  it('highlights Honey-matching mons the same way a toward bias does', () => {
    const biases: PendingTypeBiases = { toward: [], honey: [['fire']] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.highlighted).toBeTrue();
    expect(result.find(p => p.pokemonId === 1)!.highlighted).toBeFalsy();
  });
});
