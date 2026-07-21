import { ItemItem } from "../../interfaces/item-item";
import { RegularItemName } from "./item-names";

export const itemsData: Record<RegularItemName, ItemItem> = {
  'potion': {
    text: 'items.potion.name',
    name: 'potion',
    sprite: '',
    fillStyle: 'purple',
    weight: 0.5,
    description: 'items.potion.description'
  },
  'rare-candy': {
    text: 'items.rare-candy.name',
    name: 'rare-candy',
    sprite: '',
    fillStyle: 'darkcyan',
    weight: 1,
    description: 'items.rare-candy.description'
  },
  'bicycle': {
    text: 'items.bicycle.name',
    name: 'bicycle',
    sprite: '',
    fillStyle: 'darkgoldenrod',
    weight: 1,
    description: 'items.bicycle.description'
  },
  'super-potion': {
    text: 'items.super-potion.name',
    name: 'super-potion',
    sprite: '',
    fillStyle: 'darkorange',
    weight: 0.35,
    description: 'items.super-potion.description'
  },
  'x-attack': {
    text: 'items.x-attack.name',
    name: 'x-attack',
    sprite: '',
    fillStyle: 'crimson',
    weight: 1,
    description: 'items.x-attack.description'
  },
  'exp-share': {
    text: 'items.exp-share.name',
    name: 'exp-share',
    sprite: '',
    fillStyle: 'black',
    weight: 1,
    description: 'items.exp-share.description'
  },
  'hyper-potion': {
    text: 'items.hyper-potion.name',
    name: 'hyper-potion',
    sprite: '',
    fillStyle: 'deeppink',
    weight: 0.25,
    description: 'items.hyper-potion.description'
  },
  'escape-rope': {
    text: 'items.escape-rope.name',
    name: 'escape-rope',
    sprite: '',
    fillStyle: 'maroon',
    weight: 1,
    description: 'items.escape-rope.description'
  },
  'honey': {
    text: 'items.honey.name',
    name: 'honey',
    sprite: '',
    fillStyle: 'goldenrod',
    weight: 1,
    description: 'items.honey.description'
  },
  'repel': {
    text: 'items.repel.name',
    name: 'repel',
    sprite: '',
    fillStyle: 'teal',
    weight: 1,
    description: 'items.repel.description'
  },
  'poke-radar': {
    text: 'items.poke-radar.name',
    name: 'poke-radar',
    sprite: '',
    fillStyle: 'darkred',
    weight: 0.25,
    description: 'items.poke-radar.description'
  },
  'max-repel': {
    text: 'items.max-repel.name',
    name: 'max-repel',
    sprite: '',
    fillStyle: 'darkslategray',
    weight: 0.25,
    description: 'items.max-repel.description'
  },
  'link-cable': {
    text: 'items.link-cable.name',
    name: 'link-cable',
    sprite: '',
    fillStyle: 'silver',
    weight: 0.25,
    description: 'items.link-cable.description'
  },
  'revive': {
    text: 'items.revive.name',
    name: 'revive',
    sprite: '',
    fillStyle: 'gold',
    // Rarer than hyper-potion (0.25) — Revive is the scarce, high-stakes item
    // the healing economy is meant to build toward. New Experience only (see
    // ItemsService.getRegularItems); tune after playtest like V1's other dials.
    weight: 0.15,
    description: 'items.revive.description'
  }
};
