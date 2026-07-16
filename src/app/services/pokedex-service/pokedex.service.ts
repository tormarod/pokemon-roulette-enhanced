import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, Observable } from 'rxjs';
import { createDefaultPokedexData, normalizePokedexData, PokedexData, PokedexEntry } from '../../interfaces/pokedex-data';
import { evolutionChain } from '../evolution-service/evolution-chain';
import { pokemonForms } from '../pokemon-forms-service/pokemon-forms';

export type { PokedexData, PokedexEntry } from '../../interfaces/pokedex-data';

@Injectable({ providedIn: 'root' })
export class PokedexService {
  private readonly STORAGE_KEY = 'pokemon-roulette-pokedex';
  private readonly defaultPokedex: PokedexData = createDefaultPokedexData();
  private readonly spriteCache = new Map<number, string>();
  private readonly reverseEvolutionChain = this.buildReverseEvolutionChain();

  private pokedexSubject$: BehaviorSubject<PokedexData>;

  constructor() {
    this.pokedexSubject$ = new BehaviorSubject(this.getInitialPokedex());
  }

  get pokedex$(): Observable<PokedexData> {
    return this.pokedexSubject$.asObservable().pipe(distinctUntilChanged());
  }

  get currentPokedex(): PokedexData {
    return this.pokedexSubject$.getValue();
  }

  markSeen(pokemonId: number, shiny: boolean = false): void {
    const current = this.currentPokedex;
    const updatedCaught: Record<string, PokedexEntry> = { ...current.caught };

    let changed = this.upsertSeenEntry(updatedCaught, pokemonId, shiny);

    if (shiny) {
      changed = this.propagateShinyToFamily(updatedCaught, pokemonId, true) || changed;
    }

    if (!changed) {
      return;
    }

    this.updatePokedex(updatedCaught);
  }

  markWon(pokemonIds: number[]): void {
    const current = this.currentPokedex;
    const updatedCaught = { ...current.caught };
    for (const pokemonId of pokemonIds) {
      const key = String(pokemonId);
      const sprite = this.getSpriteUrl(pokemonId);
      updatedCaught[key] = { ...updatedCaught[key], won: true, sprite: updatedCaught[key]?.sprite ?? sprite };
    }
    this.updatePokedex(updatedCaught);
  }

  /**
   * Replaces the whole Pokédex from an imported (possibly partial/legacy)
   * blob — normalizes it the same way the load path does, including the
   * shiny-family propagation fixup, then persists (plan V3 §5).
   */
  replacePokedex(data: unknown): void {
    const normalized = normalizePokedexData(data);
    const { data: fixedUp } = this.enforceShinyFamilyConsistency(normalized);
    this.savePokedexToStorage(fixedUp);
    this.pokedexSubject$.next(fixedUp);
  }

  /** Permanently marks that the given Pokémon has mega-evolved at least once. No-op if already set. */
  markMega(pokemonId: number): void {
    const current = this.currentPokedex;
    const key = String(pokemonId);
    const existing = current.caught[key];

    if (existing?.mega) {
      return;
    }

    const updatedCaught = { ...current.caught };
    updatedCaught[key] = {
      won: existing?.won ?? false,
      sprite: existing?.sprite ?? this.getSpriteUrl(pokemonId),
      ...(existing?.shiny ? { shiny: true } : {}),
      mega: true,
    };

    this.updatePokedex(updatedCaught);
  }

  private getSpriteUrl(pokemonId: number): string {
    if (this.spriteCache.has(pokemonId)) {
      return this.spriteCache.get(pokemonId)!;
    }
    const url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
    this.spriteCache.set(pokemonId, url);
    return url;
  }

  private updatePokedex(caught: Record<string, PokedexEntry>): void {
    const data: PokedexData = { version: this.defaultPokedex.version, caught };
    this.savePokedexToStorage(data);
    this.pokedexSubject$.next(data);
  }

  private getInitialPokedex(): PokedexData {
    const fromStorage = this.getPokedexFromStorage();
    if (!fromStorage) {
      return this.defaultPokedex;
    }

    const { data, changed } = this.enforceShinyFamilyConsistency(fromStorage);
    if (changed) {
      this.savePokedexToStorage(data);
    }

    return data;
  }

  private propagateShinyToFamily(
    caught: Record<string, PokedexEntry>,
    sourceId: number,
    createMissing: boolean,
  ): boolean {
    let changed = false;
    for (const relatedId of this.getRelatedPokemonIds(sourceId)) {
      if (!createMissing && !caught[String(relatedId)]) continue;
      changed = this.upsertSeenEntry(caught, relatedId, true) || changed;
    }
    return changed;
  }

  private upsertSeenEntry(caught: Record<string, PokedexEntry>, pokemonId: number, shiny: boolean): boolean {
    const key = String(pokemonId);
    const existing = caught[key];
    const nextShiny = Boolean(existing?.shiny) || shiny;
    const nextEntry: PokedexEntry = {
      won: existing?.won ?? false,
      sprite: existing?.sprite ?? this.getSpriteUrl(pokemonId),
      ...(nextShiny ? { shiny: true } : {}),
      ...(existing?.mega ? { mega: true } : {}),
    };

    const changed =
      !existing ||
      existing.won !== nextEntry.won ||
      existing.sprite !== nextEntry.sprite ||
      Boolean(existing.shiny) !== Boolean(nextEntry.shiny);

    caught[key] = nextEntry;
    return changed;
  }

  /**
   * Enforces the shiny-family invariant across the whole Pokédex — permanent,
   * not a migration: runs on load and on profile import (replacePokedex), where
   * an imported blob may carry a shiny without its family flagged. Only updates
   * entries already present (does not reveal new family members).
   */
  private enforceShinyFamilyConsistency(data: PokedexData): { data: PokedexData; changed: boolean } {
    const caught: Record<string, PokedexEntry> = { ...data.caught };
    let changed = false;
    for (const [pokemonId, entry] of Object.entries(data.caught)) {
      if (!entry?.shiny) continue;
      changed = this.propagateShinyToFamily(caught, Number(pokemonId), false) || changed;
    }
    return { data: { version: data.version, caught }, changed };
  }

  private getRelatedPokemonIds(pokemonId: number): Set<number> {
    const related = new Set<number>();
    const queue: number[] = [pokemonId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (related.has(currentId)) {
        continue;
      }

      related.add(currentId);

      for (const neighborId of this.getNeighborIds(currentId)) {
        if (!related.has(neighborId)) {
          queue.push(neighborId);
        }
      }
    }

    return related;
  }

  private getNeighborIds(pokemonId: number): Set<number> {
    const neighbors = new Set<number>();

    for (const evolutionId of evolutionChain[pokemonId] ?? []) {
      neighbors.add(evolutionId);
    }

    for (const preEvolutionId of this.reverseEvolutionChain[pokemonId] ?? []) {
      neighbors.add(preEvolutionId);
    }

    const formIds = this.getFormIdsForPokemon(pokemonId);
    for (const formId of formIds) {
      neighbors.add(formId);
    }

    return neighbors;
  }

  private getFormIdsForPokemon(pokemonId: number): number[] {
    const basePokemonId = this.getBasePokemonIdForForms(pokemonId);
    if (basePokemonId === null) {
      return [];
    }

    return pokemonForms[basePokemonId]?.map(form => form.pokemonId) ?? [];
  }

  private getBasePokemonIdForForms(pokemonId: number): number | null {
    if (pokemonForms[pokemonId]) {
      return pokemonId;
    }

    for (const [basePokemonId, forms] of Object.entries(pokemonForms)) {
      if (forms.some(form => form.pokemonId === pokemonId)) {
        return Number(basePokemonId);
      }
    }

    return null;
  }

  private buildReverseEvolutionChain(): Record<number, number[]> {
    const reverseChain: Record<number, number[]> = {};

    for (const [basePokemonId, evolutions] of Object.entries(evolutionChain)) {
      const baseId = Number(basePokemonId);

      for (const evolutionId of evolutions) {
        if (!reverseChain[evolutionId]) {
          reverseChain[evolutionId] = [];
        }

        reverseChain[evolutionId].push(baseId);
      }
    }

    return reverseChain;
  }

  private savePokedexToStorage(data: PokedexData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save Pokédex to localStorage:', error);
    }
  }

  private getPokedexFromStorage(): PokedexData | null {
    const storageItem = localStorage.getItem(this.STORAGE_KEY);
    if (!storageItem) {
      return null;
    }
    try {
      return normalizePokedexData(JSON.parse(storageItem));
    } catch (error) {
      console.error('Invalid pokedex localStorage item:', storageItem, 'falling back to empty pokedex');
      return null;
    }
  }
}
