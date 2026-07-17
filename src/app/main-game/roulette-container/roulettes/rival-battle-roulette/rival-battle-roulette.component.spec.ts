import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { RivalBattleRouletteComponent } from './rival-battle-roulette.component';
import { HttpClient } from '@angular/common/http';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';

describe('RivalBattleRouletteComponent', () => {
  let component: RivalBattleRouletteComponent;
  let fixture: ComponentFixture<RivalBattleRouletteComponent>;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let generationService: GenerationService;
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
    generationService = TestBed.inject(GenerationService);

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

  // Type-matchup formula itself is tested once in
  // base-battle-roulette.component.spec.ts. This just confirms rival wires
  // its own baseNoCount(1) into it correctly.

  it('should wire a mutual-advantage matchup into rival\'s own yes/no baseline', () => {
    trainerService.addToTeam(makeTestPokemon({ power: 2, type1: 'water' })); // SE + resists fire, netScore=2
    component.currentRival = { name: 'Blue', sprite: '', quotes: [], types: ['fire'] } as GymLeader;
    component.currentRound = 0;
    (component as any).calcVictoryOdds();

    const odds: WheelItem[] = (component as any).victoryOdds;
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.rival.yes').length).toBe(5); // base(1) + power(2) + delta(2)
    expect(odds.filter((o: WheelItem) => o.text === 'game.main.roulette.rival.no').length).toBe(1); // rival's base(1) + round(0)
  });

  // ── Regression: gen6 (Calem/Serena) rival — the "rival wheel disappears" bug ──
  // (docs/plans/done/bug-rival-wheel-disappears.md / bug-stuck-empty-wheels.md).
  // Root cause: gen6's rivalByGeneration entry has ONE shared `types` array
  // (Calem and Serena battle with the same type theme) but TWO sprite/quote
  // variants (one per gender). The old code indexed `types` by the same
  // gender-derived selectedIndex as sprite/quotes, going out of bounds for the
  // male index and producing `types: [undefined]` — which crashed
  // MatchupStripComponent's icon render and left the battle screen permanently
  // blank, on every reload (deterministic, not a race).

  it('never produces an out-of-bounds (undefined) rival type for gen6 + male, where the old code broke', (done) => {
    generationService.setGenerationById(6);
    trainerService.gender = 'male';

    (component as any).onGameStateChange('battle-rival');

    // getCurrentRival's gen6 branch resolves via an async translate.get(...) subscribe.
    setTimeout(() => {
      const types = component.currentRival?.types;
      expect(types).toEqual(['normal']);
      expect(types).not.toContain(undefined);
      done();
    }, 0);
  });

  it('never produces an out-of-bounds (undefined) rival type for gen6 + female either', (done) => {
    generationService.setGenerationById(6);
    trainerService.gender = 'female';

    (component as any).onGameStateChange('battle-rival');

    setTimeout(() => {
      const types = component.currentRival?.types;
      expect(types).toEqual(['normal']);
      expect(types).not.toContain(undefined);
      done();
    }, 0);
  });
});
