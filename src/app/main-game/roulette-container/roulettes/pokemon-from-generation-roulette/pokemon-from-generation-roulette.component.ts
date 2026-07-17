import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { pokemonByGeneration } from './pokemon-by-generation';
import { Subscription } from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { applyTypeBias } from '../../../../services/trainer-service/apply-type-bias';

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

  private sourcePokemon: PokemonItem[] = [];
  private generationSubscription: Subscription | null = null;
  private biasSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
      const pokemonIds = this.pokemonByGeneration[this.generation.id] ?? [];
      const allPokemon = this.pokemonService.getPokemonByIdArray(pokemonIds);
      this.sourcePokemon = this.filterByPower(allPokemon);
      this.refreshPokemon();
    });

    this.biasSubscription = this.trainerService.getPendingTypeBiasesObservable().subscribe(() => {
      this.refreshPokemon();
    });
  }

  ngOnDestroy(): void {
    this.generationSubscription?.unsubscribe();
    this.biasSubscription?.unsubscribe();
  }

  private refreshPokemon(): void {
    this.pokemon = applyTypeBias(this.sourcePokemon, this.trainerService.currentPendingTypeBiases);
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
}
