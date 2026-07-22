import { applyTypeBias, TOWARD_SOFT_BASE_MULTIPLIER, AWAY_SOFT_BASE_MULTIPLIER, HONEY_TARGET_SHARE, HONEY_STACK_CAP } from './apply-type-bias';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PendingTypeBiases } from './trainer.service';
import { PokemonType } from '../../interfaces/pokemon-type';

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

  const noBias: PendingTypeBiases = { toward: [], away: [], honey: [] };

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
    const biases: PendingTypeBiases = { toward: [{ type: 'fire', mode: 'hard' }], away: [], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([4]);
  });

  it('hard-filters out matching type for an away bias', () => {
    const biases: PendingTypeBiases = { toward: [], away: [{ type: 'fire', mode: 'hard' }], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([1, 7]);
  });

  it('combines hard toward and hard away filters', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'water', mode: 'hard' }],
      away: [{ type: 'fire', mode: 'hard' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([7]);
  });

  it('falls back to the unfiltered pool when a hard filter would empty it', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'electric', mode: 'hard' }], away: [], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId)).toEqual([1, 4, 7]);
  });

  it('boosts weight of matching pokemon for a soft toward bias', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'fire', mode: 'soft' }], away: [], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 1)!.weight).toBe(1);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(1);
  });

  it('reduces weight of matching pokemon for a soft away bias', () => {
    const biases: PendingTypeBiases = { toward: [], away: [{ type: 'fire', mode: 'soft' }], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 1)!.weight).toBe(1);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(1);
  });

  it('combines soft toward and soft away weight adjustments on different types', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'water', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 1)!.weight).toBe(1);
  });

  it('stacks two soft-toward uses of the same type linearly (base x n)', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }],
      away: [],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER * 2);
  });

  it('stacks two soft-away uses of the same type linearly (base / n)', () => {
    const biases: PendingTypeBiases = {
      toward: [],
      away: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER / 2);
  });

  it('applies two different soft-toward types independently, multiplying together for a dual-type match', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'electric', mode: 'soft' }, { type: 'water', mode: 'soft' }],
      away: [],
      honey: []
    };
    const result = applyTypeBias(dualTypePokemon, biases);
    expect(result.find(p => p.pokemonId === 181)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 184)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 999)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER * TOWARD_SOFT_BASE_MULTIPLIER);
  });

  it('ORs multiple hard-toward types instead of intersecting them', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'hard' }, { type: 'water', mode: 'hard' }],
      away: [],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.map(p => p.pokemonId).sort()).toEqual([4, 7]);
  });

  it('treats a repeated hard-toward use of the same type as a no-op (Set dedupes)', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'hard' }, { type: 'fire', mode: 'hard' }],
      away: [],
      honey: []
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
      away: [{ type: 'fire', mode: 'soft' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(1);
  });

  it('cancels equal-count stacks on the same type, regardless of stack size', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(1);
  });

  it('leaves only the uncancelled excess in effect when counts differ on the same type', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    // 3 toward - 1 away cancelled = 2 net toward uses.
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER * 2);
  });

  it('leaves only the uncancelled excess on the away side when it outnumbers toward', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }, { type: 'fire', mode: 'soft' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    // 3 away - 1 toward cancelled = 2 net away uses.
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER / 2);
  });

  it('does not cancel toward/away uses on different types', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'water', mode: 'soft' }],
      away: [{ type: 'fire', mode: 'soft' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 7)!.weight).toBe(TOWARD_SOFT_BASE_MULTIPLIER);
    expect(result.find(p => p.pokemonId === 4)!.weight).toBe(AWAY_SOFT_BASE_MULTIPLIER);
  });

  it('does not cancel hard-mode entries on the same type', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'fire', mode: 'hard' }],
      away: [{ type: 'fire', mode: 'hard' }],
      honey: []
    };
    const result = applyTypeBias(pokemon, biases);
    // Hard-toward filters to Fire only, then hard-away would filter Fire out —
    // which would empty the pool, so the away filter is skipped (see the
    // "falls back to the unfiltered pool" behavior); Fire remains selected.
    expect(result.map(p => p.pokemonId)).toEqual([4]);
  });

  // ── V2 B3: wheel-slice highlight/dim visual tagging ────────────────────

  it('tags matching items as highlighted for a soft toward bias', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'fire', mode: 'soft' }], away: [], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.highlighted).toBeTrue();
    expect(result.find(p => p.pokemonId === 1)!.highlighted).toBeFalsy();
    expect(result.find(p => p.pokemonId === 7)!.highlighted).toBeFalsy();
  });

  it('tags matching items as dimmed for a soft away bias', () => {
    const biases: PendingTypeBiases = { toward: [], away: [{ type: 'water', mode: 'soft' }], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 7)!.dimmed).toBeTrue();
    expect(result.find(p => p.pokemonId === 1)!.dimmed).toBeFalsy();
  });

  it('tags matching items as highlighted for a hard toward bias too', () => {
    const biases: PendingTypeBiases = { toward: [{ type: 'fire', mode: 'hard' }], away: [], honey: [] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.every(p => p.highlighted)).toBeTrue();
  });

  it('does not tag anything when no bias is active', () => {
    const result = applyTypeBias(pokemon, noBias);
    expect(result.every(p => !p.highlighted && !p.dimmed)).toBeTrue();
  });

  it('does not tag an item as both highlighted and dimmed unless it matches both a toward and an away type', () => {
    const biases: PendingTypeBiases = {
      toward: [{ type: 'electric', mode: 'soft' }],
      away: [{ type: 'water', mode: 'soft' }],
      honey: []
    };
    const result = applyTypeBias(dualTypePokemon, biases);
    expect(result.find(p => p.pokemonId === 181)!.highlighted).toBeTrue();
    expect(result.find(p => p.pokemonId === 181)!.dimmed).toBeFalsy();
    expect(result.find(p => p.pokemonId === 184)!.dimmed).toBeTrue();
    expect(result.find(p => p.pokemonId === 184)!.highlighted).toBeFalsy();
    // electric-water matches both an active toward type and an active away type.
    expect(result.find(p => p.pokemonId === 999)!.highlighted).toBeTrue();
    expect(result.find(p => p.pokemonId === 999)!.dimmed).toBeTrue();
  });

  // ── Honey target-share ──────────────────────────────────────────────────

  it('a single Honey use holds the chosen type at ~55% of the wheel regardless of pool size', () => {
    const smallPool = makePool(20, 3);
    const largePool = makePool(100, 8);
    const biases: PendingTypeBiases = { toward: [], away: [], honey: [['fire']] };

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
    const biases: PendingTypeBiases = { toward: [], away: [], honey: [['fire'], ['water']] };

    const result = applyTypeBias(pool, biases);

    const expectedShare = HONEY_STACK_CAP * (1 - Math.pow(1 - HONEY_TARGET_SHARE / HONEY_STACK_CAP, 2));
    expect(setShareOf(result, new Set(['fire', 'water']))).toBeCloseTo(expectedShare, 6);
    expect(expectedShare).toBeCloseTo(0.697, 2);
  });

  it('never lets stacked Honey uses push the set share above the 75% ceiling', () => {
    const pool = makePool(60, 5);
    const honeyUses: PokemonType[][] = Array.from({ length: 8 }, () => ['fire']);
    const biases: PendingTypeBiases = { toward: [], away: [], honey: honeyUses };

    const result = applyTypeBias(pool, biases);

    expect(setShareOf(result, new Set(['fire']))).toBeLessThanOrEqual(HONEY_STACK_CAP + 1e-9);
    expect(setShareOf(result, new Set(['fire']))).toBeCloseTo(HONEY_STACK_CAP, 2);
  });

  it('is a no-op when the Honey type is entirely absent from the pool', () => {
    const biases: PendingTypeBiases = { toward: [], away: [], honey: [['electric']] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.every(p => p.weight === 1)).toBeTrue();
  });

  it('highlights Honey-matching mons the same way a toward bias does', () => {
    const biases: PendingTypeBiases = { toward: [], away: [], honey: [['fire']] };
    const result = applyTypeBias(pokemon, biases);
    expect(result.find(p => p.pokemonId === 4)!.highlighted).toBeTrue();
    expect(result.find(p => p.pokemonId === 1)!.highlighted).toBeFalsy();
  });
});
