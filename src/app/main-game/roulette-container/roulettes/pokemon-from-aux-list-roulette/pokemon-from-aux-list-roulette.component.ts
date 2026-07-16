import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { PokemonType, getTypeIconUrl } from '../../../../interfaces/pokemon-type';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-pokemon-from-aux-list-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './pokemon-from-aux-list-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './pokemon-from-aux-list-roulette.component.css'
})
export class PokemonFromAuxListRouletteComponent {

  @Input() wheelTitle: string = "Which Pokémon?";
  @Input() trainerTeam!: PokemonItem[];
  /** True only for trade-out: picking which owned Pokémon to offer is a direct pick, not a wheel spin. */
  @Input() pickMode?: boolean;
  @Output() selectedMemberEvent = new EventEmitter<PokemonItem>();

  onItemSelected(index: number): void {
    this.selectedMemberEvent.emit(this.trainerTeam[index]);
  }

  selectPokemon(pokemon: PokemonItem): void {
    this.selectedMemberEvent.emit(pokemon);
  }

  getSprite(pokemon: PokemonItem): string {
    if (pokemon.shiny) {
      return pokemon.sprite?.front_shiny || 'place-holder-pixel.png';
    }
    return pokemon.sprite?.front_default || 'place-holder-pixel.png';
  }

  getPokemonTypes(pokemon: PokemonItem): PokemonType[] {
    return [pokemon.type1, pokemon.type2].filter((type): type is PokemonType => !!type);
  }

  getTypeIconUrl(type: PokemonType): string {
    return getTypeIconUrl(type);
  }
}
