import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { applyTypeBias } from '../../../../services/trainer-service/apply-type-bias';

@Component({
  selector: 'app-mysterious-egg-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './mysterious-egg-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mysterious-egg-roulette.component.css'
})
export class MysteriousEggRouletteComponent {

  constructor(pokemonService: PokemonService, trainerService: TrainerService) {
    this.nationalDexPokemon = applyTypeBias(pokemonService.getAllPokemon(), trainerService.currentPendingTypeBiases);
  }

  nationalDexPokemon: PokemonItem[];

  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  onItemSelected(index: number): void {
    const selectedPokemon = this.nationalDexPokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
