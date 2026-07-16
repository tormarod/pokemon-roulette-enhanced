import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { applyTypeBias } from '../../../../services/trainer-service/apply-type-bias';

@Component({
  selector: 'app-trade-pokemon-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './trade-pokemon-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './trade-pokemon-roulette.component.css'
})
export class TradePokemonRouletteComponent {

  constructor(pokemonService: PokemonService, private trainerService: TrainerService) {
    this.nationalDexPokemon = applyTypeBias(pokemonService.getAllPokemon(), this.trainerService.currentPendingTypeBiases);
  }

  nationalDexPokemon: PokemonItem[];

  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  onItemSelected(index: number): void {
    const selectedPokemon = this.nationalDexPokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }
}
