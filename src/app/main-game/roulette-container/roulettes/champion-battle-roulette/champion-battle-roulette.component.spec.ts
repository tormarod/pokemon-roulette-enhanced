import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChampionBattleRouletteComponent } from './champion-battle-roulette.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';

describe('ChampionBattleRouletteComponent', () => {
  let component: ChampionBattleRouletteComponent;
  let fixture: ComponentFixture<ChampionBattleRouletteComponent>;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 6,
    text: 'pokemon.charizard',
    fillStyle: 'orange',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);

    await TestBed.configureTestingModule({
      imports: [ChampionBattleRouletteComponent, TranslateModule.forRoot()],
      providers: [
        {provide: HttpClient, useValue: httpSpyObj }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChampionBattleRouletteComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    gameStateService = TestBed.inject(GameStateService);

    gameStateService.resetGameState();
    trainerService.resetTeam();

    component.currentRound = 0;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Champion battles now factor type matchup, same as gym/elite four ──────

  it('should produce 1 yes and 3 no slices with an empty, untyped team at round 0', () => {
    component.currentChampion = { name: 'Blue', sprite: '', quotes: [] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.champion.yes').length).toBe(1);
    // Champion battles are the toughest: 0 round extras + 3 base = 3 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.champion.no').length).toBe(3);
  });

  // Type-matchup formula itself is tested once in
  // base-battle-roulette.component.spec.ts. This just confirms champion wires
  // its own baseNoCount(3) into it correctly.

  it('should wire a weak matchup into champion\'s own No count (not a Yes reduction)', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'grass' })); // weak vs fire
    component.currentChampion = { name: 'Blue', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.champion.yes').length).toBe(3); // base(1) + power(2)
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.champion.no').length).toBe(5);  // champion's base(3) + delta(2)
  });
});
