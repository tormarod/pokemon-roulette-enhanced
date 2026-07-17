import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { fossilByGeneration } from './fossil-by-generation';
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
  selector: 'app-fossil-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './fossil-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './fossil-roulette.component.css'
})
export class FossilRouletteComponent implements OnInit, OnDestroy {

  constructor(
    private generationService: GenerationService,
    private pokemonService: PokemonService,
    private trainerService: TrainerService
  ) {
  }

  fossilByGeneration = fossilByGeneration;

  generation!: GenerationItem;
  fossils: PokemonItem[] = [];
  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();
  private sourcePokemon: PokemonItem[] = [];
  private generationSubscription: Subscription | null = null;
  private biasSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
      const fossilIds = this.fossilByGeneration[this.generation.id] ?? [];
      this.sourcePokemon = this.pokemonService.getPokemonByIdArray(fossilIds);
      this.refreshFossils();
    });

    this.biasSubscription = this.trainerService.getPendingTypeBiasesObservable().subscribe(() => {
      this.refreshFossils();
    });
  }

  ngOnDestroy(): void {
    this.generationSubscription?.unsubscribe();
    this.biasSubscription?.unsubscribe();
  }

  private refreshFossils(): void {
    this.fossils = applyTypeBias(this.sourcePokemon, this.trainerService.currentPendingTypeBiases);
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.fossils[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
