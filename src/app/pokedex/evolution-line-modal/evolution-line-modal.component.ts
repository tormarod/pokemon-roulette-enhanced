import { Component, Input, OnInit, ChangeDetectionStrategy, Inject, Optional } from '@angular/core';
import { APP_BASE_HREF, CommonModule, DOCUMENT } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { ThemeService } from '../../services/theme-service/theme.service';
import { EvolutionService } from '../../services/evolution-service/evolution.service';
import { PokedexService } from '../../services/pokedex-service/pokedex.service';
import { pokemonMegaForms } from '../../services/trainer-service/pokemon-mega-forms';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType, getTypeIconUrl } from '../../interfaces/pokemon-type';

interface EvolutionStageView {
  pokemonId: number;
  text: string;
  power: number;
  type1?: PokemonType;
  type2?: PokemonType | null;
  isMega: boolean;
  locked: boolean;
  columnIndex: number;
}

@Component({
  selector: 'app-evolution-line-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './evolution-line-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './evolution-line-modal.component.css'
})
export class EvolutionLineModalComponent implements OnInit {
  @Input() pokemonId!: number;

  darkMode!: Observable<boolean>;
  baseColumns: EvolutionStageView[][] = [];
  megaStages: EvolutionStageView[] = [];
  selectedId!: number;
  revealTick = 0;
  hasError = new Set<number>();

  readonly fallbackUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/items/unknown.png';
  readonly megaSymbolUrl: string;

  constructor(
    public activeModal: NgbActiveModal,
    private themeService: ThemeService,
    private evolutionService: EvolutionService,
    private pokedexService: PokedexService,
    @Optional() @Inject(APP_BASE_HREF) baseHref: string | null,
    @Inject(DOCUMENT) doc: Document,
  ) {
    const raw = baseHref
      ?? (doc.querySelector('base') as HTMLBaseElement | null)?.getAttribute('href')
      ?? '/';
    const resolvedBase = raw.endsWith('/') ? raw : `${raw}/`;
    this.megaSymbolUrl = `${resolvedBase}Mega_Evolution_symbol.png`;
  }

  ngOnInit(): void {
    this.darkMode = this.themeService.isDark$;
    this.selectedId = this.pokemonId;

    const columns = this.evolutionService.getEvolutionLine(this.pokemonId);
    this.baseColumns = columns.map((col, ci) => col.map(mon => this.toStageView(mon, ci, false)));

    const lastColumnIndex = columns.length - 1;
    const megaSourceIds = columns[lastColumnIndex].map(mon => mon.pokemonId);
    this.megaStages = megaSourceIds
      .flatMap(baseId => (pokemonMegaForms[baseId] ?? []).map(mega => ({ mega, baseId })))
      .map(({ mega, baseId }) => this.toStageView(mega, lastColumnIndex + 1, true, baseId));

    this.revealTick++;
  }

  private toStageView(mon: PokemonItem, columnIndex: number, isMega: boolean, megaBaseId?: number): EvolutionStageView {
    const locked = isMega && !this.pokedexService.currentPokedex.caught[String(megaBaseId)]?.mega;
    return {
      pokemonId: mon.pokemonId,
      text: mon.text,
      power: mon.power,
      type1: mon.type1,
      type2: mon.type2,
      isMega,
      locked,
      columnIndex,
    };
  }

  get allStages(): EvolutionStageView[] {
    return [...this.baseColumns.flat(), ...this.megaStages];
  }

  get selectedStage(): EvolutionStageView {
    return this.allStages.find(s => s.pokemonId === this.selectedId) ?? this.allStages[0];
  }

  get pipCap(): number {
    return Math.max(5, ...this.allStages.map(s => s.power));
  }

  get powerPipFilled(): boolean[] {
    return Array.from({ length: this.pipCap }, (_, i) => i < this.selectedStage.power);
  }

  selectStage(stage: EvolutionStageView): void {
    if (stage.locked) return;
    this.selectedId = stage.pokemonId;
  }

  isSelected(stage: EvolutionStageView): boolean {
    return stage.pokemonId === this.selectedId;
  }

  spriteUrl(id: number): string {
    const base = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
    return `${base}/${id}.png`;
  }

  onSpriteError(id: number): void {
    this.hasError.add(id);
  }

  displaySpriteUrl(id: number): string {
    return this.hasError.has(id) ? this.fallbackUrl : this.spriteUrl(id);
  }

  formatPokemonNumber(id: number): string {
    if (id >= 1000) return `#${id}`;
    return `#${id.toString().padStart(3, '0')}`;
  }

  getTypeIconUrl(type: PokemonType): string {
    return getTypeIconUrl(type);
  }

  revealDelayMs(stage: EvolutionStageView): number {
    const order = this.allStages.findIndex(s => s.pokemonId === stage.pokemonId);
    return order * 220;
  }
}
