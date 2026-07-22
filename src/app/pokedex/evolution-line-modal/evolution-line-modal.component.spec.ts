import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';

import { EvolutionLineModalComponent } from './evolution-line-modal.component';
import { EvolutionService } from '../../services/evolution-service/evolution.service';
import { PokedexService, PokedexData } from '../../services/pokedex-service/pokedex.service';
import { ThemeService } from '../../services/theme-service/theme.service';
import { PokemonItem } from '../../interfaces/pokemon-item';

function mon(pokemonId: number, text: string, power: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, type1: PokemonItem['type1'] = 'grass'): PokemonItem {
  return { pokemonId, text, fillStyle: 'green', weight: 1, sprite: null, shiny: false, power, type1, type2: null };
}

describe('EvolutionLineModalComponent', () => {
  let component: EvolutionLineModalComponent;
  let fixture: ComponentFixture<EvolutionLineModalComponent>;
  let mockEvolutionService: jasmine.SpyObj<EvolutionService>;
  let mockPokedexService: { currentPokedex: PokedexData };
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  // No real mega form exists for these ids — used for the "no mega" case.
  const noMegaLine: PokemonItem[][] = [
    [mon(1, 'pokemon.bulbasaur', 1)],
    [mon(2, 'pokemon.ivysaur', 2)],
    [mon(11, 'pokemon.metapod', 3)],
  ];

  // pokemonId 3 (Venusaur) has a single real mega form (pokemonMegaForms[3]).
  const venusaurLine: PokemonItem[][] = [
    [mon(1, 'pokemon.bulbasaur', 1)],
    [mon(2, 'pokemon.ivysaur', 2)],
    [mon(3, 'pokemon.venusaur', 3)],
  ];

  // pokemonId 6 (Charizard) has two real mega forms (pokemonMegaForms[6]).
  const charizardLine: PokemonItem[][] = [
    [mon(4, 'pokemon.charmander', 1, 'fire')],
    [mon(5, 'pokemon.charmeleon', 2, 'fire')],
    [mon(6, 'pokemon.charizard', 3, 'fire')],
  ];

  function setup(line: PokemonItem[][], caught: PokedexData['caught'] = {}): void {
    TestBed.resetTestingModule();
    mockEvolutionService = jasmine.createSpyObj('EvolutionService', ['getEvolutionLine']);
    mockEvolutionService.getEvolutionLine.and.returnValue(line);
    mockPokedexService = { currentPokedex: { version: 1, caught } };
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['dismiss', 'close']);

    TestBed.configureTestingModule({
      imports: [EvolutionLineModalComponent, TranslateModule.forRoot()],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: EvolutionService, useValue: mockEvolutionService },
        { provide: PokedexService, useValue: mockPokedexService },
        { provide: ThemeService, useValue: { isDark$: of(false) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EvolutionLineModalComponent);
    component = fixture.componentInstance;
    component.pokemonId = line[0][0].pokemonId;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should create', () => {
    setup(noMegaLine);
    expect(component).toBeTruthy();
  });

  it('resolves base columns and no megas for a species with no mega form', () => {
    setup(noMegaLine);
    expect(component.baseColumns.length).toBe(3);
    expect(component.megaStages.length).toBe(0);
    expect(component.selectedId).toBe(1);
  });

  it('renders one non-branch tile per column and an arrow between them', () => {
    setup(noMegaLine);
    const tiles = fixture.nativeElement.querySelectorAll('.evo-tile:not(.evo-tile-branch):not(.evo-tile-mega)');
    const arrows = fixture.nativeElement.querySelectorAll('.evo-arrow');
    expect(tiles.length).toBe(3);
    expect(arrows.length).toBe(2);
  });

  it('selectStage updates selectedId without refetching the line or bumping revealTick', () => {
    setup(noMegaLine);
    const tickBefore = component.revealTick;
    component.selectStage(component.baseColumns[2][0]);
    expect(component.selectedId).toBe(11);
    expect(mockEvolutionService.getEvolutionLine).toHaveBeenCalledTimes(1);
    expect(component.revealTick).toBe(tickBefore);
  });

  it('a single mega form is locked until PokedexEntry.mega is set', () => {
    setup(venusaurLine, {});
    expect(component.megaStages.length).toBe(1);
    expect(component.megaStages[0].locked).toBeTrue();

    setup(venusaurLine, { '3': { won: true, sprite: null, mega: true } });
    expect(component.megaStages[0].locked).toBeFalse();
  });

  it('selectStage still selects a locked stage, so its stats can be viewed', () => {
    setup(venusaurLine, {});
    component.selectStage(component.megaStages[0]);
    expect(component.selectedId).toBe(component.megaStages[0].pokemonId);
    expect(component.selectedStage.locked).toBeTrue();
  });

  it('a locked mega tile is clickable (not disabled) and carries the locked visual class', () => {
    setup(venusaurLine, {});
    fixture.detectChanges();
    const lockedTile = fixture.nativeElement.querySelector('.evo-tile-mega');
    expect(lockedTile.disabled).toBeFalsy();
    expect(lockedTile.classList.contains('evo-tile-locked')).toBeTrue();

    lockedTile.click();
    expect(component.selectedId).toBe(component.megaStages[0].pokemonId);
  });

  it('always renders the mega note (visibility-toggled) so the card never resizes when it applies', () => {
    setup(venusaurLine, {});
    fixture.detectChanges();

    // Base form selected: note present in the DOM but hidden.
    const noteWhenBase = fixture.nativeElement.querySelector('.evo-locked-note');
    expect(noteWhenBase).not.toBeNull();
    expect(noteWhenBase.classList.contains('evo-locked-note-hidden')).toBeTrue();

    // Locked mega selected: same element, now visible.
    component.selectStage(component.megaStages[0]);
    fixture.detectChanges();
    const noteWhenLocked = fixture.nativeElement.querySelector('.evo-locked-note');
    expect(noteWhenLocked).not.toBeNull();
    expect(noteWhenLocked.classList.contains('evo-locked-note-hidden')).toBeFalse();
    expect(getComputedStyle(noteWhenLocked).visibility).toBe('visible');
  });

  it('also shows the note for an UNLOCKED mega, not just a locked one', () => {
    setup(venusaurLine, { '3': { won: true, sprite: null, mega: true } });
    component.selectStage(component.megaStages[0]);
    fixture.detectChanges();

    expect(component.selectedStage.locked).toBeFalse();
    const note = fixture.nativeElement.querySelector('.evo-locked-note');
    expect(note.classList.contains('evo-locked-note-hidden')).toBeFalse();
    expect(getComputedStyle(note).visibility).toBe('visible');
  });

  it('a species with two mega forms uses the branch-spine layout', () => {
    setup(charizardLine, { '6': { won: true, sprite: null, mega: true } });
    expect(component.megaStages.length).toBe(2);
    fixture.detectChanges();
    const megaSection = fixture.nativeElement.querySelectorAll('.evo-branch-spine .evo-tile-mega');
    expect(megaSection.length).toBe(2);
  });

  it('pipCap is at least 5, and grows to match a higher mega power', () => {
    setup(noMegaLine, {});
    expect(component.pipCap).toBe(5);

    // pokemonId 149 (Dragonite) has a real mega form with power 6.
    const dragoniteLine: PokemonItem[][] = [[mon(147, 'pokemon.dratini', 1)], [mon(148, 'pokemon.dragonair', 2)], [mon(149, 'pokemon.dragonite', 4)]];
    setup(dragoniteLine, { '149': { won: true, sprite: null, mega: true } });
    expect(component.pipCap).toBe(6);
  });

  it('formatPokemonNumber pads IDs under 1000 and leaves 1000+ unpadded', () => {
    setup(noMegaLine);
    expect(component.formatPokemonNumber(25)).toBe('#025');
    expect(component.formatPokemonNumber(1011)).toBe('#1011');
  });
});
