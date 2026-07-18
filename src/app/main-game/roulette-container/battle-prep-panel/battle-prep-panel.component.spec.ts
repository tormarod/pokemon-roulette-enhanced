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

  it('lists available potion tiers weakest-first', () => {
    component.items = [
      makeItem({ name: 'hyper-potion' }),
      makeItem({ name: 'potion' }),
    ];
    fixture.detectChanges();

    expect(component.availablePotionTiers()).toEqual(['potion', 'hyper-potion']);
  });

  it('toggles a potion tier selection on and off', () => {
    component.items = [makeItem({ name: 'potion' })];
    fixture.detectChanges();

    component.togglePotion('potion');
    expect(component.selectedPotion).toBe('potion');

    component.togglePotion('potion');
    expect(component.selectedPotion).toBeNull();
  });

  it('switching potion tier selection replaces the prior tier', () => {
    component.items = [makeItem({ name: 'potion' }), makeItem({ name: 'super-potion' })];
    fixture.detectChanges();

    component.togglePotion('potion');
    component.togglePotion('super-potion');

    expect(component.selectedPotion).toBe('super-potion');
  });

  it('emits the current draft state on confirm, with no lead/item pre-selected other than the default lead', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    component.items = [makeItem({ name: 'x-attack' }), makeItem({ name: 'potion' })];
    fixture.detectChanges();

    let emitted: any;
    component.confirmed.subscribe(value => emitted = value);

    component.onConfirm();

    expect(emitted).toEqual({ leadIndex: 0, xAttackUsed: false, potionUsed: null });
  });

  it('emits the full draft (lead, x-attack, potion) after the player makes choices', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    component.items = [makeItem({ name: 'x-attack' }), makeItem({ name: 'potion' })];
    fixture.detectChanges();

    component.selectLead(1);
    component.toggleXAttack();
    component.togglePotion('potion');

    let emitted: any;
    component.confirmed.subscribe(value => emitted = value);
    component.onConfirm();

    expect(emitted).toEqual({ leadIndex: 1, xAttackUsed: true, potionUsed: 'potion' });
  });
});
