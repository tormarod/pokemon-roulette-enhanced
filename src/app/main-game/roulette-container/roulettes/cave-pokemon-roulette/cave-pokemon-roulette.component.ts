import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { cavePokemonByGeneration } from './cave-pokemon-by-generation';
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
  selector: 'app-cave-pokemon-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './cave-pokemon-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './cave-pokemon-roulette.component.css'
})
export class CavePokemonRouletteComponent implements OnInit, OnDestroy {


  constructor(
    private generationService: GenerationService,
    private pokemonService: PokemonService,
    private trainerService: TrainerService
  ) {
  }

  cavePokemonByGeneration = cavePokemonByGeneration;

  generation!: GenerationItem;
  cavePokemon: PokemonItem[] = [];
  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();
  private generationSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
      const cavePokemonIds = this.cavePokemonByGeneration[this.generation.id] ?? [];
      this.cavePokemon = applyTypeBias(
        this.pokemonService.getPokemonByIdArray(cavePokemonIds),
        this.trainerService.currentPendingTypeBiases
      );
    });
  }

  ngOnDestroy(): void {
      this.generationSubscription?.unsubscribe();
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.cavePokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
