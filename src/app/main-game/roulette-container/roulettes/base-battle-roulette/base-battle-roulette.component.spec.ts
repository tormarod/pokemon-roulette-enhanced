import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { BaseBattleRouletteComponent } from './base-battle-roulette.component';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { PokemonType } from '../../../../interfaces/pokemon-type';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';

/**
 * Minimal concrete subclass purely for exercising the shared buildVictoryOdds()
 * logic in isolation. Real battle types (gym/elite-four/champion/rival) each
 * just call buildVictoryOdds() with their own text prefix / base no-count /
 * opponent types — that thin wiring is tested in each component's own spec.
 * The actual odds math lives here, tested once, so tuning a magnitude constant
 * doesn't require touching four separate spec files.
 */
@Component({ selector: 'app-test-battle-roulette', template: '' })
class TestBattleRouletteComponent extends BaseBattleRouletteComponent {
  testOpponentTypes: PokemonType[] | undefined = undefined;
  testBaseNoCount = 1;
  testCurrentRound = 0;

  protected onGameStateChange(): void {}

  protected calcVictoryOdds(): void {
    this.victoryOdds = this.buildVictoryOdds(this.testOpponentTypes, 'test.battle', this.testBaseNoCount, this.testCurrentRound);
  }

  recalc(): void {
    this.calcVictoryOdds();
  }
}

describe('BaseBattleRouletteComponent (buildVictoryOdds)', () => {
  let component: TestBattleRouletteComponent;
  let fixture: ComponentFixture<TestBattleRouletteComponent>;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 1,
    text: 'pokemon.test',
    fillStyle: 'green',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(
      of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } })
    );

    await TestBed.configureTestingModule({
      imports: [TestBattleRouletteComponent, TranslateModule.forRoot()],
      providers: [{ provide: HttpClient, useValue: httpSpyObj }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestBattleRouletteComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    gameStateService = TestBed.inject(GameStateService);

    gameStateService.resetGameState();
    trainerService.resetTeam();
    fixture.detectChanges();
  });

  const yesCount = () => (component as any).victoryOdds.filter((o: WheelItem) => o.text === 'test.battle.yes').length;
  const noCount = () => (component as any).victoryOdds.filter((o: WheelItem) => o.text === 'test.battle.no').length;

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('produces 1 yes and baseNoCount+round no slices for an empty, untyped team', () => {
    component.testBaseNoCount = 2;
    component.testCurrentRound = 3;
    component.recalc();
    expect(yesCount()).toBe(1);
    expect(noCount()).toBe(5);
  });

  it('adds raw power to yes when the opponent has no configured types', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 3, type1: 'water' }));
    component.testOpponentTypes = undefined;
    component.recalc();
    expect(yesCount()).toBe(4); // base(1) + power(3)
    expect(component.matchupAdvantageDelta).toBe(0);
    expect(component.matchupDisadvantageDelta).toBe(0);
  });

  it('boosts yes by the Pokémon\'s own capped delta for a strong matchup', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' })); // strong vs fire
    component.testOpponentTypes = ['fire'];
    component.recalc();
    // base(1) + yesPower(2 + min(3,2)=2) = 5 yes; no untouched by advantage
    expect(yesCount()).toBe(5);
    expect(noCount()).toBe(1);
    expect(component.matchupAdvantageDelta).toBe(2);
    expect(component.matchupDisadvantageDelta).toBe(0);
  });

  it('adds extra No tickets (not fewer Yes) for a weak matchup', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'grass' })); // weak vs fire
    component.testOpponentTypes = ['fire'];
    component.recalc();
    // Yes stays at raw power: base(1) + power(2) = 3; No gains min(3,2)=2
    expect(yesCount()).toBe(3);
    expect(noCount()).toBe(3);
    expect(component.matchupDisadvantageDelta).toBe(2);
  });

  it('caps the delta at 3 no matter how high the Pokémon\'s power is', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 8, type1: 'water' }));
    component.testOpponentTypes = ['fire'];
    component.recalc();
    expect(component.matchupAdvantageDelta).toBe(3);
  });

  it('caps a low-power Pokémon\'s delta at its own power (never a flat 3)', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 1, type1: 'grass' })); // weak vs fire
    component.testOpponentTypes = ['fire'];
    component.recalc();
    expect(component.matchupDisadvantageDelta).toBe(1); // min(3,1) = 1, never 0 and never 3
  });

  it('cancels to neutral when a Pokémon is simultaneously strong and weak', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 4, type1: 'bug' })); // strong vs grass, weak vs fire
    component.testOpponentTypes = ['grass', 'fire'];
    component.recalc();
    expect(yesCount()).toBe(5); // base(1) + power(4), no bonus either way
    expect(noCount()).toBe(1);
    expect(component.matchupAdvantageDelta).toBe(0);
    expect(component.matchupDisadvantageDelta).toBe(0);
  });

  it('a Pokémon\'s own contribution never changes when an unrelated teammate is added or removed', () => {
    const weakOne = makeTestPokemon({ pokemonId: 1, power: 4, type1: 'grass' }); // weak vs fire
    const strongOne = makeTestPokemon({ pokemonId: 2, power: 1, type1: 'water' }); // strong vs fire
    component.testOpponentTypes = ['fire'];

    trainerService.addToTeam(weakOne);
    component.recalc();
    expect(component.matchupDisadvantageDelta).toBe(3); // min(3,4)

    trainerService.addToTeam(strongOne);
    component.recalc();
    // weakOne's own penalty is unchanged by strongOne joining the team
    expect(component.matchupDisadvantageDelta).toBe(3);
    expect(component.matchupAdvantageDelta).toBe(1); // min(3,1)

    trainerService.resetTeam();
    trainerService.addToTeam(strongOne);
    component.recalc();
    // strongOne's own bonus is unchanged by weakOne having left
    expect(component.matchupAdvantageDelta).toBe(1);
  });

  it('sums contributions from multiple distinct disadvantage types across different Pokémon', () => {
    trainerService.addToTeam(makeTestPokemon({ pokemonId: 1, power: 3, type1: 'poison' })); // strong vs grass
    trainerService.addToTeam(makeTestPokemon({ pokemonId: 2, power: 3, type1: 'water' }));  // weak vs grass
    trainerService.addToTeam(makeTestPokemon({ pokemonId: 3, power: 3, type1: 'ground' })); // weak vs grass
    component.testOpponentTypes = ['grass'];
    component.recalc();

    expect(component.matchupAdvantageTypes).toEqual(['poison']);
    expect(component.matchupDisadvantageTypes).toEqual(['water', 'ground']);
    expect(component.matchupAdvantageDelta).toBe(3);
    expect(component.matchupDisadvantageDelta).toBe(6); // 2 members * min(3,3)
  });

  it('applies the x-attack power bonus on top of the type-adjusted yes power', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 4 }));
    (component as any).trainerItems = [{ name: 'x-attack', text: 'items.x-attack.name', fillStyle: 'red', weight: 1, description: '', sprite: '' }];
    component.testOpponentTypes = undefined;
    component.recalc();
    // mean power (4) added once per x-attack: base(1) + power(4) + meanPower(4) = 9
    expect(yesCount()).toBe(9);
  });
});
