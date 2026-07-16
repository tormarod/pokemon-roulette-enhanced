import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { legendaryByGeneration } from './legendaries-by-generation';
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
  selector: 'app-legendary-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './legendary-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './legendary-roulette.component.css'
})
export class LegendaryRouletteComponent implements OnInit, OnDestroy {

  constructor(
    private generationService: GenerationService,
    private pokemonService: PokemonService,
    private trainerService: TrainerService
  ) {
  }

  legendaryByGeneration = legendaryByGeneration;

  generation!: GenerationItem;
  legendaries: PokemonItem[] = [];
  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  private generationSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
      const legendaryIds = this.legendaryByGeneration[this.generation.id] ?? [];
      this.legendaries = applyTypeBias(
        this.pokemonService.getPokemonByIdArray(legendaryIds),
        this.trainerService.currentPendingTypeBiases
      );
    });
  }

  ngOnDestroy(): void {
    this.generationSubscription?.unsubscribe();
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.legendaries[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
