/**
 * Base path of the PokeAPI official artwork, identical to the URLs baked into
 * every `national-dex-pokemon.ts` entry.
 */
export const OFFICIAL_ARTWORK_BASE_URL =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

/**
 * Builds the official-artwork URLs for any species or alternate-form id.
 *
 * Species entries carry these URLs as static data, but alternate forms (ids
 * above 10000: Alolan/Galarian/mega/... variants) are assembled at runtime and
 * used to start out with `sprite: null`, filled in later by a PokeAPI lookup.
 * Anything reading `sprite.front_default` synchronously — the evolution and
 * trade popups, the pick-a-Pokémon wheel — lost that race and rendered an empty
 * tile. The paths are deterministic, so derive them locally instead of asking
 * the network (the same move `ItemSpriteService` already made for items).
 */
export function officialArtworkSprites(pokemonId: number): { front_default: string; front_shiny: string } {
  return {
    front_default: `${OFFICIAL_ARTWORK_BASE_URL}/${pokemonId}.png`,
    front_shiny: `${OFFICIAL_ARTWORK_BASE_URL}/shiny/${pokemonId}.png`
  };
}
