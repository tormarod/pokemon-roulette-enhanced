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

  private sourcePokemon: PokemonItem[] = [];
  private generationSubscription: Subscription | null = null;
  private biasSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
      const legendaryIds = this.legendaryByGeneration[this.generation.id] ?? [];
      this.sourcePokemon = this.pokemonService.getPokemonByIdArray(legendaryIds);
      this.refreshLegendaries();
    });

    this.biasSubscription = this.trainerService.getPendingTypeBiasesObservable().subscribe(() => {
      this.refreshLegendaries();
    });
  }

  ngOnDestroy(): void {
    this.generationSubscription?.unsubscribe();
    this.biasSubscription?.unsubscribe();
  }

  private refreshLegendaries(): void {
    this.legendaries = applyTypeBias(this.sourcePokemon, this.trainerService.currentPendingTypeBiases);
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.legendaries[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
