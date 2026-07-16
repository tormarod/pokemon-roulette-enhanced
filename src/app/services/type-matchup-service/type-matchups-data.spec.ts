import { typeMatchups } from './type-matchups-data';
import { PokemonType } from '../../interfaces/pokemon-type';

describe('typeMatchups data shape', () => {
  const types = Object.keys(typeMatchups) as PokemonType[];

  it('has an entry for every type with all four lists present', () => {
    for (const t of types) {
      const entry = typeMatchups[t];
      expect(Array.isArray(entry.strongAgainst)).toBeTrue();
      expect(Array.isArray(entry.weakAgainst)).toBeTrue();
      expect(Array.isArray(entry.resists)).toBeTrue();
      expect(Array.isArray(entry.immuneTo)).toBeTrue();
    }
  });

  it('never resists and is immune to the same type at once', () => {
    for (const t of types) {
      const entry = typeMatchups[t];
      for (const r of entry.resists) {
        expect(entry.immuneTo).not.toContain(r);
      }
    }
  });

  it('never both resists/is-immune-to and is weak against the same type', () => {
    for (const t of types) {
      const entry = typeMatchups[t];
      for (const w of entry.weakAgainst) {
        expect(entry.resists).not.toContain(w);
        expect(entry.immuneTo).not.toContain(w);
      }
    }
  });

  it('resists/immuneTo lists only contain known types', () => {
    for (const t of types) {
      const entry = typeMatchups[t];
      for (const r of [...entry.resists, ...entry.immuneTo]) {
        expect(types).toContain(r);
      }
    }
  });

  // Spot checks against the canonical type chart.
  it('ground is immune to electric', () => {
    expect(typeMatchups.ground.immuneTo).toContain('electric');
  });

  it('steel is immune to poison and resists many types', () => {
    expect(typeMatchups.steel.immuneTo).toContain('poison');
    expect(typeMatchups.steel.resists).toContain('ice');
  });

  it('normal is immune to ghost', () => {
    expect(typeMatchups.normal.immuneTo).toContain('ghost');
  });

  it('fairy is immune to dragon', () => {
    expect(typeMatchups.fairy.immuneTo).toContain('dragon');
  });

  it('ghost is immune to normal and fighting', () => {
    expect(typeMatchups.ghost.immuneTo).toContain('normal');
    expect(typeMatchups.ghost.immuneTo).toContain('fighting');
  });

  it('dark is immune to psychic', () => {
    expect(typeMatchups.dark.immuneTo).toContain('psychic');
  });

  it('flying is immune to ground', () => {
    expect(typeMatchups.flying.immuneTo).toContain('ground');
  });

  it('water resists fire, water, ice, and steel', () => {
    expect(typeMatchups.water.resists).toEqual(jasmine.arrayContaining(['fire', 'water', 'ice', 'steel']));
  });
});
