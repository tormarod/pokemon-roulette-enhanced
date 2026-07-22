import { TestBed } from '@angular/core/testing';

import { EvolutionService } from './evolution.service';
import { HttpClient } from '@angular/common/http';
import { PokemonItem } from '../../interfaces/pokemon-item';

describe('EvolutionService', () => {
  let service: EvolutionService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);

    TestBed.configureTestingModule({
      providers: [
        {provide: HttpClient, useValue: httpSpyObj }
      ]
    });
    service = TestBed.inject(EvolutionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should resolve >10000 evolution ids using form alias metadata', () => {
    const pikachu = service.nationalDexPokemon.find((pokemon) => pokemon.pokemonId === 25) as PokemonItem;
    const evolutions = service.getEvolutions(pikachu);

    expect(evolutions.map((pokemon) => pokemon.pokemonId)).toContain(10100);

    const alolaRaichu = evolutions.find((pokemon) => pokemon.pokemonId === 10100) as PokemonItem;
    expect(alolaRaichu.text).toBe('pokemon.raichu-alola');
    expect(alolaRaichu.sprite).toBeNull();
  });

  it('should resolve chained form evolutions where source and target are >10000', () => {
    const alolaVulpix = service.nationalDexPokemon.find((pokemon) => pokemon.pokemonId === 37) as PokemonItem;
    const source = structuredClone(alolaVulpix);
    source.pokemonId = 10103;
    source.text = 'Vulpix (Alola)';

    const evolutions = service.getEvolutions(source);

    expect(evolutions.length).toBe(1);
    expect(evolutions[0].pokemonId).toBe(10104);
    expect(evolutions[0].text).toBe('pokemon.ninetales-alola');
    expect(evolutions[0].sprite).toBeNull();
  });

  it('should carry form-specific types when evolving into an alternative form', () => {
    const pikachu = service.nationalDexPokemon.find(p => p.pokemonId === 25) as PokemonItem;
    const evolutions = service.getEvolutions(pikachu);
    const alolaRaichu = evolutions.find(p => p.pokemonId === 10100) as PokemonItem;

    expect(alolaRaichu.type1).toBe('electric');
    expect(alolaRaichu.type2).toBe('psychic');
  });

  describe('getEvolutionLine', () => {
    it('should return the full 3-stage line for Bulbasaur', () => {
      const line = service.getEvolutionLine(1);
      expect(line.map(col => col.map(p => p.pokemonId))).toEqual([[1], [2], [3]]);
      expect(service.hasEvolutionLine(1)).toBeTrue();
    });

    it('should return the identical line when viewed from a mid-line species', () => {
      const line = service.getEvolutionLine(2);
      expect(line.map(col => col.map(p => p.pokemonId))).toEqual([[1], [2], [3]]);
    });

    it('should include all eeveelutions in a single branching column', () => {
      const line = service.getEvolutionLine(133);
      expect(line[0].map(p => p.pokemonId)).toEqual([133]);
      expect(line[1].length).toBeGreaterThanOrEqual(3);
    });

    it('should return a single column for a non-evolving species', () => {
      const line = service.getEvolutionLine(128);
      expect(line.map(col => col.map(p => p.pokemonId))).toEqual([[128]]);
      expect(service.hasEvolutionLine(128)).toBeFalse();
    });

    it('should include both Ninjask and Shedinja for Nincada', () => {
      const line = service.getEvolutionLine(290);
      expect(line[1].map(p => p.pokemonId)).toEqual(jasmine.arrayContaining([291, 292]));
    });

    it('should include the Alolan Raichu form-alias branch for Pikachu', () => {
      // Pichu (172) is a pre-evolution of Pikachu (25), so Pikachu sits at
      // depth 1 and its evolutions (Raichu/Alolan Raichu) sit at depth 2.
      const line = service.getEvolutionLine(25);
      const pikachuColumn = line.findIndex(col => col.some(p => p.pokemonId === 25));
      const evolutionIds = line[pikachuColumn + 1].map(p => p.pokemonId);
      expect(evolutionIds).toContain(26);
      expect(evolutionIds).toContain(10100);
      line[pikachuColumn + 1].forEach(mon => expect(mon).toBeDefined());
    });
  });
});
