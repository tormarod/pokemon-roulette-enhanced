import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService, TypeBiasEntry } from '../../../../services/trainer-service/trainer.service';
import { PokemonType } from '../../../../interfaces/pokemon-type';

const TOWARD_SOFT_WEIGHT_MULTIPLIER = 4;
const AWAY_SOFT_WEIGHT_MULTIPLIER = 0.25;

@Component({
  selector: 'app-trade-pokemon-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './trade-pokemon-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './trade-pokemon-roulette.component.css'
})
export class TradePokemonRouletteComponent {

  constructor(pokemonService: PokemonService, private trainerService: TrainerService) {
    this.nationalDexPokemon = this.applyTypeBias(pokemonService.getAllPokemon());
  }

  nationalDexPokemon: PokemonItem[];

  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  onItemSelected(index: number): void {
    const selectedPokemon = this.nationalDexPokemon[index];
    this.selectedPokemonEvent.emit(selectedPokemon);
  }

  /**
   * A hard filter that would empty the pool is skipped (falls back to the
   * unfiltered pool) rather than ever soft-locking the trade wheel.
   */
  private applyTypeBias(pokemon: PokemonItem[]): PokemonItem[] {
    const { toward, away } = this.trainerService.currentPendingTypeBiases;
    let result = pokemon;

    if (toward?.mode === 'hard') {
      const filtered = result.filter(p => this.matchesType(p, toward.type));
      if (filtered.length > 0) {
        result = filtered;
      }
    }
    if (away?.mode === 'hard') {
      const filtered = result.filter(p => !this.matchesType(p, away.type));
      if (filtered.length > 0) {
        result = filtered;
      }
    }

    if (toward?.mode === 'soft' || away?.mode === 'soft') {
      result = result.map(p => this.applySoftWeight(p, toward, away));
    }

    return result;
  }

  private applySoftWeight(pokemon: PokemonItem, toward: TypeBiasEntry | null, away: TypeBiasEntry | null): PokemonItem {
    let weight = pokemon.weight;
    if (toward?.mode === 'soft' && this.matchesType(pokemon, toward.type)) {
      weight *= TOWARD_SOFT_WEIGHT_MULTIPLIER;
    }
    if (away?.mode === 'soft' && this.matchesType(pokemon, away.type)) {
      weight *= AWAY_SOFT_WEIGHT_MULTIPLIER;
    }
    return weight === pokemon.weight ? pokemon : { ...pokemon, weight };
  }

  private matchesType(pokemon: PokemonItem, type: PokemonType): boolean {
    return pokemon.type1 === type || pokemon.type2 === type;
  }
}
