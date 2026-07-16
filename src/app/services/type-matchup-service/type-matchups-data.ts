import { TypeMatchupMap } from '../../interfaces/type-matchup';

export const typeMatchups: TypeMatchupMap = {
    bug: {
        strongAgainst: ['dark', 'grass', 'psychic'],
        weakAgainst: ['fire', 'flying', 'rock'],
        resists: ['grass', 'fighting', 'ground'],
        immuneTo: []
    },
    dark: {
        strongAgainst: ['ghost', 'psychic'],
        weakAgainst: ['bug', 'fairy', 'fighting'],
        resists: ['ghost', 'dark'],
        immuneTo: ['psychic']
    },
    dragon: {
        strongAgainst: ['dragon'],
        weakAgainst: ['dragon', 'fairy', 'ice'],
        resists: ['fire', 'water', 'electric', 'grass'],
        immuneTo: []
    },
    electric: {
        strongAgainst: ['flying', 'water'],
        weakAgainst: ['ground'],
        resists: ['electric', 'flying', 'steel'],
        immuneTo: []
    },
    fairy: {
        strongAgainst: ['dark', 'dragon', 'fighting'],
        weakAgainst: ['poison', 'steel'],
        resists: ['fighting', 'bug', 'dark'],
        immuneTo: ['dragon']
    },
    fighting: {
        strongAgainst: ['dark', 'ice', 'normal', 'rock', 'steel'],
        weakAgainst: ['fairy', 'flying', 'psychic'],
        resists: ['bug', 'rock', 'dark'],
        immuneTo: []
    },
    fire: {
        strongAgainst: ['bug', 'grass', 'ice', 'steel'],
        weakAgainst: ['ground', 'rock', 'water'],
        resists: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'],
        immuneTo: []
    },
    flying: {
        strongAgainst: ['bug', 'fighting', 'grass'],
        weakAgainst: ['electric', 'ice', 'rock'],
        resists: ['grass', 'fighting', 'bug'],
        immuneTo: ['ground']
    },
    ghost: {
        strongAgainst: ['ghost', 'psychic'],
        weakAgainst: ['dark', 'ghost'],
        resists: ['poison', 'bug'],
        immuneTo: ['normal', 'fighting']
    },
    grass: {
        strongAgainst: ['ground', 'rock', 'water'],
        weakAgainst: ['bug', 'fire', 'flying', 'ice', 'poison'],
        resists: ['water', 'electric', 'grass', 'ground'],
        immuneTo: []
    },
    ground: {
        strongAgainst: ['electric', 'fire', 'poison', 'rock', 'steel'],
        weakAgainst: ['grass', 'ice', 'water'],
        resists: ['poison', 'rock'],
        immuneTo: ['electric']
    },
    ice: {
        strongAgainst: ['dragon', 'flying', 'grass', 'ground'],
        weakAgainst: ['fighting', 'fire', 'rock', 'steel'],
        resists: ['ice'],
        immuneTo: []
    },
    normal: {
        strongAgainst: [],
        weakAgainst: ['fighting'],
        resists: [],
        immuneTo: ['ghost']
    },
    poison: {
        strongAgainst: ['fairy', 'grass'],
        weakAgainst: ['ground', 'psychic'],
        resists: ['grass', 'fighting', 'poison', 'bug', 'fairy'],
        immuneTo: []
    },
    psychic: {
        strongAgainst: ['fighting', 'poison'],
        weakAgainst: ['bug', 'dark', 'ghost'],
        resists: ['fighting', 'psychic'],
        immuneTo: []
    },
    rock: {
        strongAgainst: ['bug', 'fire', 'flying', 'ice'],
        weakAgainst: ['fighting', 'grass', 'ground', 'steel', 'water'],
        resists: ['normal', 'fire', 'poison', 'flying'],
        immuneTo: []
    },
    steel: {
        strongAgainst: ['fairy', 'ice', 'rock'],
        weakAgainst: ['fighting', 'fire', 'ground'],
        resists: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'],
        immuneTo: ['poison']
    },
    water: {
        strongAgainst: ['fire', 'ground', 'rock'],
        weakAgainst: ['electric', 'grass'],
        resists: ['fire', 'water', 'ice', 'steel'],
        immuneTo: []
    }
};
