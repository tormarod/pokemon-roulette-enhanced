import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PokemonType, PokemonTypeData, pokemonTypeData, getTypeIconUrl } from '../../../../interfaces/pokemon-type';

/** Traditional Pokémon type color scheme, for the choice buttons. */
const TYPE_FILL_STYLES: Record<PokemonType, string> = {
  normal: '#A8A878',
  fighting: '#C03028',
  flying: '#A890F0',
  poison: '#A040A0',
  ground: '#E0C068',
  rock: '#B8A038',
  bug: '#A8B820',
  ghost: '#705898',
  steel: '#B8B8D0',
  fire: '#F08030',
  water: '#6890F0',
  grass: '#78C850',
  electric: '#F8D030',
  psychic: '#F85888',
  ice: '#98D8D8',
  dragon: '#7038F8',
  dark: '#705848',
  fairy: '#EE99AC',
};

/**
 * A direct pick, not a wheel — the whole point of Honey/Repel/Poké Radar/Max
 * Repel is that the player chooses the type themselves. Kept in the
 * roulette-container's screen family (and the "-roulette" naming/GameState
 * plumbing) for consistency with how every other sub-screen is reached, but
 * intentionally has no <app-wheel> or RNG in it.
 */
@Component({
  selector: 'app-select-from-type-list-roulette',
  imports: [TranslatePipe],
  templateUrl: './select-from-type-list-roulette.component.html',
  styleUrl: './select-from-type-list-roulette.component.css'
})
export class SelectFromTypeListRouletteComponent {
  @Input() screenTitle = 'game.main.roulette.typeBias.which';
  @Output() selectedTypeEvent = new EventEmitter<PokemonType>();

  readonly types: PokemonTypeData[] = pokemonTypeData;

  getTypeIconUrl(type: PokemonType): string {
    return getTypeIconUrl(type);
  }

  getTypeFillStyle(type: PokemonType): string {
    return TYPE_FILL_STYLES[type];
  }

  selectType(type: PokemonType): void {
    this.selectedTypeEvent.emit(type);
  }
}
