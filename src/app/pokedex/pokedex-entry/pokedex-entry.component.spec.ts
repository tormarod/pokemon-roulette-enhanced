import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { PokedexEntryComponent } from './pokedex-entry.component';
import { DarkModeService } from '../../services/dark-mode-service/dark-mode.service';
import { PokemonService } from '../../services/pokemon-service/pokemon.service';
import { of } from 'rxjs';
import { PokedexEntry } from '../../services/pokedex-service/pokedex.service';

describe('PokedexEntryComponent', () => {
  let component: PokedexEntryComponent;
  let fixture: ComponentFixture<PokedexEntryComponent>;
  let darkModeServiceSpy: jasmine.SpyObj<DarkModeService>;
  let pokemonServiceSpy: jasmine.SpyObj<PokemonService>;

  const fallbackSpriteUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png';
  const seenEntry: PokedexEntry = { won: false, sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' };
  const wonEntry: PokedexEntry = { won: true, sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' };

  beforeEach(async () => {
    localStorage.clear();

    darkModeServiceSpy = jasmine.createSpyObj('DarkModeService', [], {
      darkMode$: of(false)
    });
    pokemonServiceSpy = jasmine.createSpyObj('PokemonService', ['getPokemonById']);
    pokemonServiceSpy.getPokemonById.and.returnValue({
      pokemonId: 25,
      text: 'pokemon.pikachu',
      fillStyle: 'yellow',
      sprite: { front_default: fallbackSpriteUrl, front_shiny: fallbackSpriteUrl.replace('artwork/', 'artwork/shiny/') },
      shiny: false,
      power: 2,
      weight: 1
    });

    await TestBed.configureTestingModule({
      imports: [PokedexEntryComponent, TranslateModule.forRoot()],
      providers: [
        { provide: DarkModeService, useValue: darkModeServiceSpy },
        { provide: PokemonService, useValue: pokemonServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PokedexEntryComponent);
    component = fixture.componentInstance;
    component.pokemonId = 25;
    component.entry = undefined;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('VIS-01: falls back to the static roster sprite when entry is undefined', () => {
    const img = fixture.nativeElement.querySelector('.cell-img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe(fallbackSpriteUrl);
  });

  it('VIS-02: renders the entry sprite when entry is defined', () => {
    component.entry = seenEntry;
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('.cell-img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe(seenEntry.sprite as string);
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('VIS-03: adds .won class when entry.won is true', () => {
    component.entry = wonEntry;
    fixture.detectChanges();
    const cell = fixture.nativeElement.querySelector('.pokedex-cell') as HTMLElement;
    expect(cell.classList).toContain('won');
  });

  it('VIS-03: does not add .won class for seen-only entry', () => {
    component.entry = seenEntry;
    fixture.detectChanges();
    const cell = fixture.nativeElement.querySelector('.pokedex-cell') as HTMLElement;
    expect(cell.classList).not.toContain('won');
  });

  it('VIS-04: renders number badge when unseen', () => {
    const badge = fixture.nativeElement.querySelector('.number-badge') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent?.trim()).toBe('#025');
  });

  it('VIS-04: renders number badge when seen', () => {
    component.entry = seenEntry;
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.number-badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('#025');
  });

  it('VIS-05: isCaptured is false when entry is undefined', () => {
    expect(component.isCaptured).toBeFalse();
  });

  it('VIS-05: isCaptured is true when entry is defined', () => {
    component.entry = seenEntry;
    fixture.detectChanges();
    expect(component.isCaptured).toBeTrue();
  });

  it('VIS-05: pokemonText returns i18n key', () => {
    expect(component.pokemonText).toBe('pokemon.pikachu');
  });

  it('VIS-06: adds .not-captured class to cell when entry is undefined', () => {
    const cell = fixture.nativeElement.querySelector('.pokedex-cell') as HTMLElement;
    expect(cell.classList).toContain('not-captured');
  });

  it('VIS-06: does not have .not-captured class when entry is defined', () => {
    component.entry = seenEntry;
    fixture.detectChanges();
    const cell = fixture.nativeElement.querySelector('.pokedex-cell') as HTMLElement;
    expect(cell.classList).not.toContain('not-captured');
  });

  it('formatPokemonNumber formats IDs 1-9 with 3 digit padding', () => {
    expect(component.formatPokemonNumber(1)).toBe('#001');
  });

  it('formatPokemonNumber formats IDs 1000+ without padding', () => {
    expect(component.formatPokemonNumber(1011)).toBe('#1011');
  });

  it('DETAIL-01: clicking a seen cell emits entryClicked with pokemonId and entry', () => {
    component.entry = seenEntry;
    fixture.detectChanges();
    spyOn(component.entryClicked, 'emit');
    const cell = fixture.nativeElement.querySelector('.pokedex-cell') as HTMLElement;
    cell.click();
    expect(component.entryClicked.emit).toHaveBeenCalledOnceWith({ pokemonId: 25, entry: seenEntry });
  });

  it('DETAIL-01: clicking an unseen cell emits entryClicked with pokemonId and undefined entry', () => {
    component.entry = undefined;
    fixture.detectChanges();
    spyOn(component.entryClicked, 'emit');
    const cell = fixture.nativeElement.querySelector('.pokedex-cell') as HTMLElement;
    cell.click();
    expect(component.entryClicked.emit).toHaveBeenCalledOnceWith({ pokemonId: 25, entry: undefined });
  });

  it('DETAIL-01: cells always have the .clickable CSS class', () => {
    const cell = fixture.nativeElement.querySelector('.pokedex-cell') as HTMLElement;
    expect(cell.classList).toContain('clickable');

    component.entry = seenEntry;
    fixture.detectChanges();
    expect(cell.classList).toContain('clickable');
  });
});
