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

  it('ignores clicks on a non-forced lead card while a lead is forced', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    fixture.componentRef.setInput('forcedIndex', 1);
    fixture.detectChanges();

    component.selectLead(0);

    expect(component.selectedLeadIndex).toBe(1);
  });

  it('locks the default lead onto the forced index when it starts at index 0', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    fixture.componentRef.setInput('forcedIndex', 0);
    fixture.detectChanges();

    expect(component.selectedLeadIndex).toBe(0);
  });

  it('marks every non-forced lead card with the disabled class and attribute', () => {
    component.team = [makePokemon({ pokemonId: 1 }), makePokemon({ pokemonId: 2 })];
    component.forcedIndex = 1;
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.battle-prep-lead-card');
    expect(cards[0].classList.contains('disabled')).toBeTrue();
    expect(cards[0].disabled).toBeTrue();
    expect(cards[1].disabled).toBeFalse();
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

  // ── oddsPreview: live win-chance preview, same computeOdds() as the wheel ──

  it('computes a null preview for an empty team', () => {
    component.team = [];
    fixture.detectChanges();

    expect(component.oddsPreview).toBeNull();
  });

  it('computes a non-null preview once a team is present', () => {
    component.team = [makePokemon({ power: 2 })];
    component.baseNoCount = 1;
    component.currentRound = 0;
    fixture.detectChanges();
    component.selectLead(0);

    expect(component.oddsPreview).not.toBeNull();
    expect(component.oddsPreview?.yesTickets).toBe(3); // base(1) + power(2)
  });

  it('lowers the preview win chance when the lead switches from an advantaged to a disadvantaged member', () => {
    const advantaged = makePokemon({ pokemonId: 1, power: 2, type1: 'water' }); // SE + resists fire
    const disadvantaged = makePokemon({ pokemonId: 2, power: 2, type1: 'grass' }); // weak vs fire
    component.team = [advantaged, disadvantaged];
    component.opponentTypes = ['fire'];
    component.baseNoCount = 1;
    component.currentRound = 0;
    fixture.detectChanges();

    component.selectLead(0);
    const advantagedChance = component.oddsPreview!.winChance;

    component.selectLead(1);
    const disadvantagedChance = component.oddsPreview!.winChance;

    expect(disadvantagedChance).toBeLessThan(advantagedChance);
  });

  it('raises the preview win chance when x-attack is toggled on', () => {
    component.team = [makePokemon({ power: 2 })];
    component.items = [makeItem({ name: 'x-attack' })];
    component.baseNoCount = 1;
    component.currentRound = 0;
    fixture.detectChanges();

    component.selectLead(0);
    const withoutXAttack = component.oddsPreview!.winChance;

    component.toggleXAttack();
    const withXAttack = component.oddsPreview!.winChance;

    expect(withXAttack).toBeGreaterThan(withoutXAttack);
  });

  it('scales the x-attack preview bonus with currentRound', () => {
    component.team = [makePokemon({ power: 4 })];
    component.items = [makeItem({ name: 'x-attack' })];
    component.baseNoCount = 1;
    component.currentRound = 3;
    fixture.detectChanges();

    component.selectLead(0);
    component.toggleXAttack();

    // base(1) + power(4) + xAttackBonus(meanPower=4 + round=3 = 7) = 12
    expect(component.oddsPreview?.yesTickets).toBe(12);
  });
});
