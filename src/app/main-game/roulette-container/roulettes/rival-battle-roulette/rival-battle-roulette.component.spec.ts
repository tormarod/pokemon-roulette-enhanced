import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { RivalBattleRouletteComponent } from './rival-battle-roulette.component';
import { HttpClient } from '@angular/common/http';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';

describe('RivalBattleRouletteComponent', () => {
  let component: RivalBattleRouletteComponent;
  let fixture: ComponentFixture<RivalBattleRouletteComponent>;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 25,
    text: 'pokemon.pikachu',
    fillStyle: 'yellow',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);

    await TestBed.configureTestingModule({
      imports: [RivalBattleRouletteComponent, TranslateModule.forRoot()],
      providers: [
        {provide: HttpClient, useValue: httpSpyObj }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RivalBattleRouletteComponent);
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

  // ── Rival battles now factor type matchup, same as gym/elite four ─────────

  it('should produce 1 yes and 1 no slice with an empty, untyped team at round 0', () => {
    component.currentRival = { name: 'Blue', sprite: '', quotes: [] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.rival.yes').length).toBe(1);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.rival.no').length).toBe(1);
  });

  it('should boost yes slices for a single strong-matched Pokémon (team size 1 -> delta 1)', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' }));
    component.currentRival = { name: 'Blue', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    // base(1) + effectivePower(2+1=3) = 4 yes;  round(0) + base(1) = 1 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.rival.yes').length).toBe(4);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.rival.no').length).toBe(1);
    expect(component.advantageLabel).toBe('advantage');
  });

  it('should reduce yes slices for a single weak-matched Pokémon, floored at 1 effective power', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'grass' }));
    component.currentRival = { name: 'Blue', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    // base(1) + effectivePower(max(1, 2-1)=1) = 2 yes;  1 no
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.rival.yes').length).toBe(2);
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.rival.no').length).toBe(1);
    expect(component.advantageLabel).toBe('disadvantage');
  });
});
