import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { BattlePrepPanelComponent } from './battle-prep-panel.component';
import { PokemonItem } from '../../../interfaces/pokemon-item';
import { ItemItem } from '../../../interfaces/item-item';

describe('BattlePrepPanelComponent', () => {
  let component: BattlePrepPanelComponent;
  let fixture: ComponentFixture<BattlePrepPanelComponent>;

  const makePokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 1,
    text: 'pokemon.test',
    fillStyle: 'green',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  const makeItem = (overrides: Partial<ItemItem> = {}): ItemItem => ({
    name: 'x-attack',
    text: '',
    fillStyle: '',
    weight: 1,
    description: '',
    sprite: 'x',
    ...overrides,
  } as ItemItem);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattlePrepPanelComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(BattlePrepPanelComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('defaults the lead selection to index 0', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    fixture.detectChanges();

    expect(component.selectedLeadIndex).toBe(0);
  });

  it('renders one card per team member', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 }), makePokemon({ pokemonId: 3 })];
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.battle-prep-lead-card');
    expect(cards.length).toBe(3);
  });

  it('updates selectedLeadIndex when a different lead is picked', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    fixture.detectChanges();

    component.selectLead(1);

    expect(component.selectedLeadIndex).toBe(1);
  });

  it('ignores clicks on the disabled (marked) lead card', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    component.disabledIndex = 1;
    fixture.detectChanges();

    component.selectLead(1);

    expect(component.selectedLeadIndex).toBe(0);
  });

  it('shifts the default lead off the disabled index when it starts at index 0', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    fixture.componentRef.setInput('disabledIndex', 0);
    fixture.detectChanges();

    expect(component.selectedLeadIndex).toBe(1);
  });

  it('marks the disabled lead card with the disabled class and attribute', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    component.disabledIndex = 1;
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.battle-prep-lead-card');
    expect(cards[1].classList.contains('disabled')).toBeTrue();
    expect(cards[1].disabled).toBeTrue();
    expect(cards[0].disabled).toBeFalse();
  });

  it('computes a positive per-member delta preview for a favorable matchup', () => {
    component.team = [makePokemon({ power: 2, type1: 'water' })]; // SE + resists fire
    component.opponentTypes = ['fire'];
    fixture.detectChanges();

    expect(component.getMemberDelta(component.team[0])).toBeGreaterThan(0);
  });

  it('computes zero delta when opponentTypes is undefined', () => {
    component.team = [makePokemon({ power: 2, type1: 'water' })];
    component.opponentTypes = undefined;
    fixture.detectChanges();

    expect(component.getMemberDelta(component.team[0])).toBe(0);
  });

  it('hides the x-attack button when none is held', () => {
    component.team = [makePokemon()];
    component.items = [];
    fixture.detectChanges();

    expect(component.hasXAttack()).toBeFalse();
  });

  it('toggles x-attack selection when held', () => {
    component.team = [makePokemon()];
    component.items = [makeItem({ name: 'x-attack' })];
    fixture.detectChanges();

    component.toggleXAttack();
    expect(component.xAttackSelected).toBeTrue();

    component.toggleXAttack();
    expect(component.xAttackSelected).toBeFalse();
  });

  it('does not toggle x-attack when none is held', () => {
    component.team = [makePokemon()];
    component.items = [];
    fixture.detectChanges();

    component.toggleXAttack();

    expect(component.xAttackSelected).toBeFalse();
  });

  it('emits the current draft state on confirm, with no lead/item pre-selected other than the default lead', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    component.items = [makeItem({ name: 'x-attack' }), makeItem({ name: 'potion' })];
    fixture.detectChanges();

    let emitted: any;
    component.confirmed.subscribe(value => emitted = value);

    component.onConfirm();

    expect(emitted).toEqual({ leadIndex: 0, xAttackUsed: false });
  });

  it('emits the full draft (lead, x-attack) after the player makes choices', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    component.items = [makeItem({ name: 'x-attack' }), makeItem({ name: 'potion' })];
    fixture.detectChanges();

    component.selectLead(1);
    component.toggleXAttack();

    let emitted: any;
    component.confirmed.subscribe(value => emitted = value);
    component.onConfirm();

    expect(emitted).toEqual({ leadIndex: 1, xAttackUsed: true });
  });
});
