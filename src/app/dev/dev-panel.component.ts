import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainerService } from '../services/trainer-service/trainer.service';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { PokemonService } from '../services/pokemon-service/pokemon.service';
import { ItemsService } from '../services/items-service/items.service';
import { nationalDexPokemon } from '../services/pokemon-service/national-dex-pokemon';
import { setWheelForceMode, setPickedIndex } from './dev-override';
import { PokemonItem } from '../interfaces/pokemon-item';
import { ItemItem } from '../interfaces/item-item';
import { RegularItemName } from '../services/items-service/item-names';
import { MegaStoneItemName, megaStoneItemNames } from '../services/items-service/item-names';
import { GameState } from '../services/game-state-service/game-state';

@Component({
  selector: 'app-dev-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dev-panel.component.html',
  styleUrl: './dev-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevPanelComponent {
  private readonly trainerService = inject(TrainerService);
  private readonly gameStateService = inject(GameStateService);
  private readonly pokemonService = inject(PokemonService);
  private readonly itemsService = inject(ItemsService);

  panelOpen = false;
  addPokemonName = '';
  addPokemonPower = 1;
  addPokemonShiny = false;
  pickedSliceIndex: number | null = null;
  selectedState: GameState = 'game-start';
  selectedItem: RegularItemName | MegaStoneItemName = 'potion';

  readonly gameStates: GameState[] = [
    'game-start',
    'character-select',
    'starter-pokemon',
    'check-shininess',
    'start-adventure',
    'catch-pokemon',
    'select-form',
    'evolve-pokemon',
    'select-from-pokemon-list',
    'select-from-item-list',
    'select-from-type-list',
    'select-evolution',
    'gym-battle',
    'check-evolution',
    'game-over',
    'adventure-continues',
    'team-rocket-encounter',
    'steal-pokemon',
    'mysterious-egg',
    'legendary-encounter',
    'catch-legendary',
    'trade-pokemon',
    'find-item',
    'area-zero',
    'catch-paradox',
    'explore-cave',
    'catch-cave-pokemon',
    'snorlax-encounter',
    'go-fishing',
    'find-fossil',
    'battle-rival',
    'elite-four-preparation',
    'elite-four-battle',
    'champion-battle',
    'game-finish'
  ];

  readonly regularItems: RegularItemName[] = [
    'potion',
    'rare-candy',
    'bicycle',
    'super-potion',
    'x-attack',
    'exp-share',
    'hyper-potion',
    'escape-rope',
    'honey',
    'repel',
    'poke-radar',
    'max-repel',
    'link-cable'
  ];

  readonly megaStones: MegaStoneItemName[] = megaStoneItemNames as unknown as MegaStoneItemName[];

  get team(): PokemonItem[] {
    return this.trainerService.getTeam();
  }

  get items(): ItemItem[] {
    return this.trainerService.getItems();
  }

  get stored(): PokemonItem[] {
    return this.trainerService.getStored();
  }

  get allItems(): (RegularItemName | MegaStoneItemName)[] {
    return [...this.regularItems, ...this.megaStones];
  }

  togglePanel(): void {
    this.panelOpen = !this.panelOpen;
  }

  addPokemonToTeam(): void {
    const pokemon = this.findPokemon(this.addPokemonName);
    if (!pokemon) {
      console.error('Pokémon not found:', this.addPokemonName);
      return;
    }

    this.pokemonService.getPokemonSprites(pokemon.pokemonId).subscribe(spriteData => {
      const newPokemon: PokemonItem = {
        ...pokemon,
        power: this.addPokemonPower as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
        shiny: this.addPokemonShiny,
        sprite: spriteData.sprite
      };
      this.trainerService.addToTeam(newPokemon);
      this.addPokemonName = '';
    });
  }

  removeFromTeam(pokemon: PokemonItem): void {
    this.trainerService.removeFromTeam(pokemon);
  }

  addPokemonToPC(): void {
    const pokemon = this.findPokemon(this.addPokemonName);
    if (!pokemon) {
      console.error('Pokémon not found:', this.addPokemonName);
      return;
    }

    this.pokemonService.getPokemonSprites(pokemon.pokemonId).subscribe(spriteData => {
      const newPokemon: PokemonItem = {
        ...pokemon,
        power: this.addPokemonPower as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
        shiny: this.addPokemonShiny,
        sprite: spriteData.sprite
      };
      const newStored = [...this.stored, newPokemon];
      this.trainerService.commitTeamAndStorage(this.team, newStored);
      this.addPokemonName = '';
    });
  }

  removeFromPC(pokemon: PokemonItem): void {
    const newStored = this.stored.filter(p => p.pokemonId !== pokemon.pokemonId);
    this.trainerService.commitTeamAndStorage(this.team, newStored);
  }

  addItem(): void {
    const item = this.itemsService.getItem(this.selectedItem);
    if (!item) {
      console.error('Item not found:', this.selectedItem);
      return;
    }
    // Pass the canonical item data straight to the trainer service; when its
    // sprite is empty (e.g. link-cable), addToItems() resolves it via
    // ItemSpriteService — the same single source of truth the real game uses.
    this.trainerService.addToItems(item);
  }

  removeItem(item: ItemItem): void {
    this.trainerService.removeItem(item);
  }

  setWheelWin(): void {
    setWheelForceMode('win');
  }

  setWheelLose(): void {
    setWheelForceMode('lose');
  }

  setWheelOff(): void {
    setWheelForceMode('off');
  }

  forceSlice(): void {
    if (this.pickedSliceIndex !== null && this.pickedSliceIndex >= 0) {
      setWheelForceMode('pick');
      setPickedIndex(this.pickedSliceIndex);
      this.pickedSliceIndex = null;
    }
  }

  jumpToState(): void {
    this.gameStateService.setNextState(this.selectedState);
  }

  advanceRound(): void {
    this.gameStateService.advanceRound();
  }

  addBadge(): void {
    this.trainerService.addBadge(0);
  }

  private findPokemon(nameOrId: string): PokemonItem | null {
    const id = parseInt(nameOrId, 10);
    if (!isNaN(id)) {
      return nationalDexPokemon.find(p => p.pokemonId === id) || null;
    }
    return nationalDexPokemon.find(
      p => p.text.toLowerCase().includes(nameOrId.toLowerCase())
    ) || null;
  }

}
