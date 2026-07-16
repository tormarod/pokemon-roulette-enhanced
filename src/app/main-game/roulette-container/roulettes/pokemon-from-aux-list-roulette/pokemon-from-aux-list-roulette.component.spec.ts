import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { PokemonFromAuxListRouletteComponent } from './pokemon-from-aux-list-roulette.component';
import { PokemonItem } from '../../../../interfaces/pokemon-item';


describe('PokemonFromAuxListRouletteComponent', () => {
  let component: PokemonFromAuxListRouletteComponent;
  let fixture: ComponentFixture<PokemonFromAuxListRouletteComponent>;

  const makePokemon = (pokemonId: number, text: string): PokemonItem => ({
    pokemonId,
    text,
    fillStyle: 'green',
    sprite: null,
    shiny: false,
    power: 1,
    weight: 1,
  } as PokemonItem);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokemonFromAuxListRouletteComponent, TranslateModule.forRoot()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PokemonFromAuxListRouletteComponent);
    component = fixture.componentInstance;
    component.trainerTeam = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a wheel, not clickable cards, when pickMode is not set', () => {
    component.trainerTeam = [makePokemon(1, 'pokemon.bulbasaur'), makePokemon(2, 'pokemon.ivysaur')];
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-wheel')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.pokemon-pick-button').length).toBe(0);
  });

  it('should render one clickable card per Pokemon, not a wheel, when pickMode is true', () => {
    component.trainerTeam = [makePokemon(1, 'pokemon.bulbasaur'), makePokemon(2, 'pokemon.ivysaur')];
    component.pickMode = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-wheel')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.pokemon-pick-button').length).toBe(2);
  });

  it('should emit the exact Pokemon immediately when its card is clicked — a direct pick, no RNG', () => {
    const bulbasaur = makePokemon(1, 'pokemon.bulbasaur');
    const ivysaur = makePokemon(2, 'pokemon.ivysaur');
    component.trainerTeam = [bulbasaur, ivysaur];
    component.pickMode = true;
    fixture.detectChanges();

    spyOn(component.selectedMemberEvent, 'emit');
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.pokemon-pick-button');
    buttons[1].click();

    expect(component.selectedMemberEvent.emit).toHaveBeenCalledWith(ivysaur);
  });
});
