import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { fishByGeneration } from './fish-by-generation';
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
  selector: 'app-fishing-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './fishing-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './fishing-roulette.component.css'
})
export class FishingRouletteComponent implements OnInit, OnDestroy {

  constructor(
    private generationService: GenerationService,
    private pokemonService: PokemonService,
    private trainerService: TrainerService
  ) {
  }

  fishByGeneration = fishByGeneration;

  generation!: GenerationItem;
  fish: PokemonItem[] = [];
  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();
  private sourcePokemon: PokemonItem[] = [];
  private generationSubscription: Subscription | null = null;
  private biasSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
      const fishIds = this.fishByGeneration[this.generation.id] ?? [];
      this.sourcePokemon = this.pokemonService.getPokemonByIdArray(fishIds);
      this.refreshFish();
    });

    this.biasSubscription = this.trainerService.getPendingTypeBiasesObservable().subscribe(() => {
      this.refreshFish();
    });
  }

  ngOnDestroy(): void {
      this.generationSubscription?.unsubscribe();
      this.biasSubscription?.unsubscribe();
  }

  private refreshFish(): void {
    this.fish = applyTypeBias(this.sourcePokemon, this.trainerService.currentPendingTypeBiases);
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.fish[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
