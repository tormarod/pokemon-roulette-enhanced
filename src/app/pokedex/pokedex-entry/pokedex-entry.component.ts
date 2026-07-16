import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { DarkModeService } from '../../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../../services/theme-service/theme.service';
import { PokemonService } from '../../services/pokemon-service/pokemon.service';
import { PokedexEntry } from '../../services/pokedex-service/pokedex.service';

export interface PokedexEntryClickEvent {
  pokemonId: number;
  entry: PokedexEntry | undefined;
}

@Component({
  selector: 'app-pokedex-entry',
  standalone: true,
  imports: [CommonModule, NgbTooltipModule, TranslatePipe],
  templateUrl: './pokedex-entry.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './pokedex-entry.component.css'
})
export class PokedexEntryComponent implements OnInit {
  @Input() pokemonId!: number;
  @Input() entry: PokedexEntry | undefined;
  @Output() entryClicked = new EventEmitter<PokedexEntryClickEvent>();

  darkMode!: Observable<boolean>;

  constructor(
    private darkModeService: DarkModeService,
    private themeService: ThemeService,
    private pokemonService: PokemonService
  ) {}

  ngOnInit(): void {
    this.darkMode = this.themeService.isDark$;
  }

  get isCaptured(): boolean {
    return !!this.entry;
  }

  get isWon(): boolean {
    return this.entry?.won === true;
  }

  get pokemonText(): string {
    return this.pokemonService.getPokemonById(this.pokemonId)?.text ?? 'pokemon.unknown';
  }

  get spriteUrl(): string | null {
    return this.entry?.sprite ?? this.pokemonService.getPokemonById(this.pokemonId)?.sprite?.front_default ?? null;
  }

  onCellClick(): void {
    this.entryClicked.emit({ pokemonId: this.pokemonId, entry: this.entry! });
  }

  formatPokemonNumber(id: number): string {
    if (id >= 1000) return `#${id}`;
    return `#${id.toString().padStart(3, '0')}`;
  }
}
