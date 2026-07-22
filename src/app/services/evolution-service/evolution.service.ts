import { Injectable } from '@angular/core';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { evolutionChain } from './evolution-chain';
import { PokemonService } from '../pokemon-service/pokemon.service';
import { formAliasById } from '../pokemon-forms-service/pokemon-forms';
import { NINCADA_ID } from '../../constants/pokemon-ids.constants';

@Injectable({
  providedIn: 'root'
})
export class EvolutionService {

  constructor(private pokemonService: PokemonService) {
    this.nationalDexPokemon = this.pokemonService.getAllPokemon();
  }

  evolutionChain = evolutionChain;
  nationalDexPokemon: PokemonItem[];
  private reverseChain: Record<number, number[]> = this.buildReverseChain();

  canEvolve(pokemon: PokemonItem): boolean {
    return !!this.evolutionChain[pokemon.pokemonId];
  }

  getEvolutions(pokemon: PokemonItem): PokemonItem[] {
    const evolutions: PokemonItem[] = [];

    this.evolutionChain[pokemon.pokemonId].forEach(evolutionId => {
      const evolution = this.resolveEvolutionPokemon(evolutionId);

      if (evolution) {
        evolutions.push(evolution);
      }
    });

    return evolutions;
  }

  isNincadaSpecialEvolution(pokemon: PokemonItem): boolean {
    return pokemon.pokemonId === NINCADA_ID;
  }

  /**
   * Full evolution line for a species, grouped into stage columns:
   * column 0 = base stage, column 1 = second stage, etc. Branches (Eevee,
   * Wurmple, Nincada) put multiple entries in one column. A species that does
   * not evolve returns a single column containing only itself.
   */
  getEvolutionLine(pokemonId: number): PokemonItem[][] {
    const family = new Set<number>();
    const queue: number[] = [pokemonId];
    while (queue.length) {
      const id = queue.shift()!;
      if (family.has(id)) continue;
      family.add(id);
      for (const next of this.evolutionChain[id] ?? []) if (!family.has(next)) queue.push(next);
      for (const prev of this.reverseChain[id] ?? []) if (!family.has(prev)) queue.push(prev);
    }

    const roots = [...family].filter(
      id => !(this.reverseChain[id] ?? []).some(prev => family.has(prev)),
    );

    const depth = new Map<number, number>();
    const bfs: number[] = [...roots];
    roots.forEach(r => depth.set(r, 0));
    while (bfs.length) {
      const id = bfs.shift()!;
      const d = depth.get(id)!;
      for (const next of this.evolutionChain[id] ?? []) {
        if (!family.has(next)) continue;
        if (!depth.has(next) || depth.get(next)! > d + 1) {
          depth.set(next, d + 1);
          bfs.push(next);
        }
      }
    }

    const maxDepth = Math.max(0, ...depth.values());
    const columns: PokemonItem[][] = Array.from({ length: maxDepth + 1 }, () => []);
    for (const id of [...family].sort((a, b) => a - b)) {
      const mon = this.resolveEvolutionPokemon(id);
      if (mon) columns[depth.get(id) ?? 0].push(mon);
    }
    return columns;
  }

  /** True when a species has any pre-evolution or evolution to display. */
  hasEvolutionLine(pokemonId: number): boolean {
    const line = this.getEvolutionLine(pokemonId);
    return line.length > 1 || line.some(col => col.length > 1);
  }

  private buildReverseChain(): Record<number, number[]> {
    const reverse: Record<number, number[]> = {};
    for (const [baseId, evolutions] of Object.entries(this.evolutionChain)) {
      for (const evolutionId of evolutions) {
        (reverse[evolutionId] ??= []).push(Number(baseId));
      }
    }
    return reverse;
  }

  private resolveEvolutionPokemon(evolutionId: number): PokemonItem | undefined {
    if (evolutionId <= 10000) {
      return this.pokemonService.getPokemonById(evolutionId);
    }

    const alias = formAliasById[evolutionId];

    if (!alias) {
      return undefined;
    }

    const basePokemon = this.pokemonService.getPokemonById(alias.baseId);

    if (!basePokemon) {
      return undefined;
    }

    const formPokemon = structuredClone(basePokemon);
    formPokemon.pokemonId = alias.form.pokemonId;
    formPokemon.text = alias.form.text;
    formPokemon.fillStyle = alias.form.fillStyle;
    formPokemon.type1 = alias.form.type1;
    formPokemon.type2 = alias.form.type2;
    formPokemon.weight = alias.form.weight;
    formPokemon.sprite = null;

    return formPokemon;
  }
}
