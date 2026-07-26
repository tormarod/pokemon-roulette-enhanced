import { Injectable } from '@angular/core';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { nationalDexPokemon } from './national-dex-pokemon';
import { officialArtworkSprites } from './official-artwork';

@Injectable({
  providedIn: 'root'
})
export class PokemonService {

  private readonly pokemonById: Map<number, PokemonItem>;

  constructor() {
    this.pokemonById = new Map(
      this.nationalDexPokemon.map(pokemon => [pokemon.pokemonId, pokemon])
    );
  }

  readonly nationalDexPokemon = nationalDexPokemon;

  /**
   * Official-artwork URLs for a Pokémon id, derived locally — species entries
   * already carry these URLs, and alternate forms follow the same paths.
   */
  getSpriteUrls(pokemonId: number): { front_default: string; front_shiny: string } {
    return officialArtworkSprites(pokemonId);
  }

  getPokemonById(pokemonId: number): PokemonItem | undefined {
    return this.pokemonById.get(pokemonId);
  }

  getPokemonByIdArray(pokemonIds: number[]): PokemonItem[] {
    return pokemonIds
      .map(pokemonId => this.pokemonById.get(pokemonId))
      .filter((pokemon): pokemon is PokemonItem => pokemon !== undefined);
  }

  getAllPokemon(): PokemonItem[] {
    return this.nationalDexPokemon;
  }
}