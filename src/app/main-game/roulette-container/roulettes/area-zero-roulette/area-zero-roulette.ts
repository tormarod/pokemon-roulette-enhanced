import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
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
export class AreaZeroRoulette {

  constructor(private pokemonService: PokemonService, private trainerService: TrainerService) {
    this.paradoxPokemon = applyTypeBias(
      this.pokemonService.getPokemonByIdArray(areaZeroParadoxPokemonIds),
      this.trainerService.currentPendingTypeBiases
    );
  }

  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  paradoxPokemon: PokemonItem[] = [];

  onItemSelected(index: number): void {
    const selectedPokemon = this.paradoxPokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }

}
