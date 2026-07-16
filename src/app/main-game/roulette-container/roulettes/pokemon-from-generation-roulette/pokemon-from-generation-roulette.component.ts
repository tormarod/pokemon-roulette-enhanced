import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { pokemonByGeneration } from './pokemon-by-generation';
import { Subscription } from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService, TypeBiasEntry } from '../../../../services/trainer-service/trainer.service';
import { PokemonType } from '../../../../interfaces/pokemon-type';

const TOWARD_SOFT_WEIGHT_MULTIPLIER = 4;
const AWAY_SOFT_WEIGHT_MULTIPLIER = 0.25;

@Component({
  selector: 'app-pokemon-from-generation-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './pokemon-from-generation-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './pokemon-from-generation-roulette.component.css'
})
export class PokemonFromGenerationRouletteComponent implements OnInit, OnDestroy {

  constructor(
    private generationService: GenerationService,
    private pokemonService: PokemonService,
    private trainerService: TrainerService) {
  }

  pokemonByGeneration = pokemonByGeneration;

  generation!: GenerationItem;
  pokemon: PokemonItem[] = [];
  @Input() currentRound: number = 0;
  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  private generationSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
      const pokemonIds = this.pokemonByGeneration[this.generation.id] ?? [];
      const allPokemon = this.pokemonService.getPokemonByIdArray(pokemonIds);
      this.pokemon = this.applyTypeBias(this.filterByPower(allPokemon));
    });
  }

  ngOnDestroy(): void {
    this.generationSubscription?.unsubscribe();
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.pokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }

  private filterByPower(pokemon: PokemonItem[]): PokemonItem[] {
    if (this.currentRound < 2) {
      return pokemon.filter(p => p.power === 1);
    } else if (this.currentRound < 4) {
      return pokemon.filter(p => p.power <= 2);
    }
    return pokemon;
  }

  /**
   * A hard filter that would empty the pool is skipped (falls back to the
   * unfiltered pool) rather than ever soft-locking the catch wheel.
   */
  private applyTypeBias(pokemon: PokemonItem[]): PokemonItem[] {
    const { toward, away } = this.trainerService.currentPendingTypeBiases;
    let result = pokemon;

    if (toward?.mode === 'hard') {
      const filtered = result.filter(p => this.matchesType(p, toward.type));
      if (filtered.length > 0) {
        result = filtered;
      }
    }
    if (away?.mode === 'hard') {
      const filtered = result.filter(p => !this.matchesType(p, away.type));
      if (filtered.length > 0) {
        result = filtered;
      }
    }

    if (toward?.mode === 'soft' || away?.mode === 'soft') {
      result = result.map(p => this.applySoftWeight(p, toward, away));
    }

    return result;
  }

  private applySoftWeight(pokemon: PokemonItem, toward: TypeBiasEntry | null, away: TypeBiasEntry | null): PokemonItem {
    let weight = pokemon.weight;
    if (toward?.mode === 'soft' && this.matchesType(pokemon, toward.type)) {
      weight *= TOWARD_SOFT_WEIGHT_MULTIPLIER;
    }
    if (away?.mode === 'soft' && this.matchesType(pokemon, away.type)) {
      weight *= AWAY_SOFT_WEIGHT_MULTIPLIER;
    }
    return weight === pokemon.weight ? pokemon : { ...pokemon, weight };
  }

  private matchesType(pokemon: PokemonItem, type: PokemonType): boolean {
    return pokemon.type1 === type || pokemon.type2 === type;
  }
}
