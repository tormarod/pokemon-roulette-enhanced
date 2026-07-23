export type PokemonType =
  | 'normal'
  | 'fighting'
  | 'flying'
  | 'poison'
  | 'ground'
  | 'rock'
  | 'bug'
  | 'ghost'
  | 'steel'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'psychic'
  | 'ice'
  | 'dragon'
  | 'dark'
  | 'fairy';

export interface PokemonTypeData {
  id: number;
  key: PokemonType;
}

export const pokemonTypeData: PokemonTypeData[] = [
  { id: 1, key: 'normal' },
  { id: 2, key: 'fighting' },
  { id: 3, key: 'flying' },
  { id: 4, key: 'poison' },
  { id: 5, key: 'ground' },
  { id: 6, key: 'rock' },
  { id: 7, key: 'bug' },
  { id: 8, key: 'ghost' },
  { id: 9, key: 'steel' },
  { id: 10, key: 'fire' },
  { id: 11, key: 'water' },
  { id: 12, key: 'grass' },
  { id: 13, key: 'electric' },
  { id: 14, key: 'psychic' },
  { id: 15, key: 'ice' },
  { id: 16, key: 'dragon' },
  { id: 17, key: 'dark' },
  { id: 18, key: 'fairy' }
];

export const pokemonTypeDataByKey: Record<PokemonType, PokemonTypeData> = pokemonTypeData.reduce((acc, typeData) => {
  acc[typeData.key] = typeData;
  return acc;
}, {} as Record<PokemonType, PokemonTypeData>);

const TYPE_ICON_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/types/generation-viii/brilliant-diamond-shining-pearl';

export function getTypeIconUrl(type: PokemonType): string {
  return `${TYPE_ICON_BASE_URL}/${pokemonTypeDataByKey[type].id}.png`;
}

/** Canonical per-type color, shared by ability capsule flavor colors and any UI type chip/badge. */
export const pokemonTypeColors: Record<PokemonType, string> = {
  normal: '#A8A77A', fighting: '#C22E28', flying: '#A98FF3', poison: '#A33EA1',
  ground: '#E2BF65', rock: '#B6A136', bug: '#A6B91A', ghost: '#735797',
  steel: '#B7B7CE', fire: '#EE8130', water: '#6390F0', grass: '#7AC74C',
  electric: '#F7D02C', psychic: '#F95587', ice: '#96D9D6', dragon: '#6F35FC',
  dark: '#705746', fairy: '#D685AD'
};