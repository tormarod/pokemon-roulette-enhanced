import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { areaZeroParadoxPokemonIds } from './area-zero-pokemon';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { applyTypeBias } from '../../../../services/trainer-service/apply-type-bias';

@Component({
  selector: 'app-area-zero-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './area-zero-roulette.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './area-zero-roulette.css',
})
export class AreaZeroRoulette implements OnInit, OnDestroy {

  constructor(private pokemonService: PokemonService, private trainerService: TrainerService) {
  }

  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  paradoxPokemon: PokemonItem[] = [];

  private sourcePokemon: PokemonItem[] = [];
  private biasSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.sourcePokemon = this.pokemonService.getPokemonByIdArray(areaZeroParadoxPokemonIds);
    this.biasSubscription = this.trainerService.getPendingTypeBiasesObservable().subscribe(() => {
      this.refreshParadoxPokemon();
    });
  }

  ngOnDestroy(): void {
    this.biasSubscription?.unsubscribe();
  }

  private refreshParadoxPokemon(): void {
    this.paradoxPokemon = applyTypeBias(this.sourcePokemon, this.trainerService.currentPendingTypeBiases);
  }

  onItemSelected(index: number): void {
    const selectedPokemon = this.paradoxPokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }

}
