import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { StatsService } from './stats.service';
import { PlayerStats, PLAYER_STATS_VERSION } from '../../interfaces/player-stats';
import { TrainerService } from '../trainer-service/trainer.service';
import { PokemonItem } from '../../interfaces/pokemon-item';

describe('StatsService', () => {
  const STATS_KEY = 'pokemon-roulette-stats';
  const RUN_KEY = 'pokemon-roulette-run';

  let service: StatsService;
  let trainerService: TrainerService;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 1,
    text: 'pokemon.bulbasaur',
    fillStyle: 'green',
    type1: 'grass',
    type2: 'poison',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  const configureFreshTestBed = () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } }));

    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpyObj }],
    });
  };

  beforeEach(() => {
    localStorage.clear();
    configureFreshTestBed();
    service = TestBed.inject(StatsService);
    trainerService = TestBed.inject(TrainerService);
    trainerService.resetTeam();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start from default stats when nothing is saved', () => {
    expect(service.current.runsPlayed).toBe(0);
    expect(service.current.version).toBe(PLAYER_STATS_VERSION);
    expect(service.current.fastestVictoryRounds).toBeNull();
  });

  it('should use its own localStorage key, never the run key', () => {
    expect(service['STATS_STORAGE_KEY']).not.toBe(RUN_KEY);
  });

  it('should persist through the injected instance and reload it on a fresh service', () => {
    service['update'](stats => ({ ...stats, runsPlayed: 3, victories: 1 }));

    const stored = JSON.parse(localStorage.getItem(STATS_KEY)!) as PlayerStats;
    expect(stored.runsPlayed).toBe(3);
    expect(stored.victories).toBe(1);

    TestBed.resetTestingModule();
    configureFreshTestBed();
    const reloaded = TestBed.inject(StatsService);
    expect(reloaded.current.runsPlayed).toBe(3);
    expect(reloaded.current.victories).toBe(1);
  });

  it('should emit updated stats on the observable', done => {
    const emissions: number[] = [];
    service.getStatsObservable().subscribe(stats => emissions.push(stats.runsPlayed));

    service['update'](stats => ({ ...stats, runsPlayed: 5 }));

    expect(emissions).toEqual([0, 5]);
    done();
  });

  it('should default missing fields from a legacy/partial saved blob without throwing', () => {
    const legacyBlob = { version: 1, runsPlayed: 7 };
    localStorage.setItem(STATS_KEY, JSON.stringify(legacyBlob));

    expect(() => {
      TestBed.resetTestingModule();
      configureFreshTestBed();
      service = TestBed.inject(StatsService);
    }).not.toThrow();

    expect(service.current.runsPlayed).toBe(7);
    expect(service.current.victories).toBe(0);
    expect(service.current.battleTypeWins).toEqual({ gym: 0, rival: 0, eliteFour: 0, champion: 0 });
    expect(service.current.speciesOwnedCounts).toEqual({});
  });

  it('should discard a corrupt saved blob and fall back to defaults without throwing', () => {
    localStorage.setItem(STATS_KEY, '{not valid json');

    expect(() => {
      TestBed.resetTestingModule();
      configureFreshTestBed();
      service = TestBed.inject(StatsService);
    }).not.toThrow();

    expect(service.current.runsPlayed).toBe(0);
  });

  it('should reset stats back to defaults and persist the reset', () => {
    service['update'](stats => ({ ...stats, runsPlayed: 10, victories: 4 }));

    service.reset();

    expect(service.current.runsPlayed).toBe(0);
    expect(service.current.victories).toBe(0);
    const stored = JSON.parse(localStorage.getItem(STATS_KEY)!) as PlayerStats;
    expect(stored.runsPlayed).toBe(0);
  });

  it('should never be cleared by the run-persistence storage key', () => {
    service['update'](stats => ({ ...stats, runsPlayed: 2 }));
    localStorage.removeItem(RUN_KEY);

    expect(service.current.runsPlayed).toBe(2);
  });

  // ── record* instrumentation ─────────────────────────────────────────────

  describe('recordRunStart', () => {
    it('should bump runsPlayed, the generation count and the starter count', () => {
      service.recordRunStart(3, 1);

      expect(service.current.runsPlayed).toBe(1);
      expect(service.current.generationPlayCounts).toEqual({ 3: 1 });
      expect(service.current.starterCounts).toEqual({ 1: 1 });
    });

    it('should reset the in-progress species-seen scratch set for the new run', () => {
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1 }));
      service.recordRunStart(1, 4);
      service.recordRunEnd(true, 5);

      // Only species added after recordRunStart should be folded in — pokemonId 1
      // was added before the (re)start and must not leak into this run's totals.
      expect(service.current.speciesOwnedCounts).toEqual({});
    });
  });

  describe('recordCapture / recordShiny', () => {
    it('should increment pokemonCaught on every capture and shiniesCaught only for shinies', () => {
      service.recordCapture();
      service.recordCapture();
      service.recordShiny();

      expect(service.current.pokemonCaught).toBe(2);
      expect(service.current.shiniesCaught).toBe(1);
    });
  });

  describe('recordBattleWin / recordBattleLoss', () => {
    it('should credit a gym win to both the win tally and the lifetime gym-leader count', () => {
      service.recordBattleWin('gym');

      expect(service.current.battleTypeWins.gym).toBe(1);
      expect(service.current.gymLeadersDefeated).toBe(1);
    });

    it('should credit elite-four and champion wins to their lifetime counters', () => {
      service.recordBattleWin('eliteFour');
      service.recordBattleWin('champion');

      expect(service.current.eliteFourDefeated).toBe(1);
      expect(service.current.championsDefeated).toBe(1);
    });

    it('should not credit a lifetime "defeated" counter for a rival win', () => {
      service.recordBattleWin('rival');

      expect(service.current.battleTypeWins.rival).toBe(1);
      expect(service.current.gymLeadersDefeated).toBe(0);
      expect(service.current.eliteFourDefeated).toBe(0);
      expect(service.current.championsDefeated).toBe(0);
    });

    it('should record a loss with a nemesis key against the loss tally and nemesisDefeats', () => {
      service.recordBattleLoss('gym', 'gym:Brock');
      service.recordBattleLoss('gym', 'gym:Brock');

      expect(service.current.battleTypeLosses.gym).toBe(2);
      expect(service.current.nemesisDefeats).toEqual({ 'gym:Brock': 2 });
    });

    it('should record a rival loss without ever touching nemesisDefeats', () => {
      service.recordBattleLoss('rival');

      expect(service.current.battleTypeLosses.rival).toBe(1);
      expect(service.current.nemesisDefeats).toEqual({});
    });
  });

  describe('recordRunEnd', () => {
    it('should fold species seen during the run into speciesOwnedCounts and team types into typeCounts', () => {
      service.recordRunStart(1, 1);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1, type1: 'grass', type2: 'poison' }));
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 4, type1: 'fire', type2: null }));

      service.recordRunEnd(false, 3);

      expect(service.current.speciesOwnedCounts).toEqual({ 1: 1, 4: 1 });
      expect(service.current.typeCounts).toEqual({ grass: 1, poison: 1, fire: 1 });
      expect(service.current.speciesVictoryCounts).toEqual({});
    });

    it('should credit species ownership even for a species that evolved away before the run ended', () => {
      // Simulates: caught pokemonId 1, then it evolved into pokemonId 2 mid-run.
      // Both species were "owned" during the run per the plan's ownership definition.
      service.recordRunStart(1, 1);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1 }));
      trainerService.replaceForEvolution(trainerService.getTeam()[0], makeTestPokemon({ pokemonId: 2 }));

      service.recordRunEnd(true, 5);

      expect(service.current.speciesOwnedCounts).toEqual({ 1: 1, 2: 1 });
    });

    it('should record a victory: increment victories, extend the win streak, and track fastest/longest records', () => {
      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 10);

      expect(service.current.victories).toBe(1);
      expect(service.current.currentStreak).toBe(1);
      expect(service.current.bestWinStreak).toBe(1);
      expect(service.current.fastestVictoryRounds).toBe(10);
      expect(service.current.longestRunRounds).toBe(10);

      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 6);

      expect(service.current.currentStreak).toBe(2);
      expect(service.current.bestWinStreak).toBe(2);
      expect(service.current.fastestVictoryRounds).toBe(6);
      expect(service.current.longestRunRounds).toBe(10);
    });

    it('should record a defeat: increment defeats, start/extend a loss streak, and reset the win streak', () => {
      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 10);

      service.recordRunStart(1, 1);
      service.recordRunEnd(false, 4);

      expect(service.current.defeats).toBe(1);
      expect(service.current.currentStreak).toBe(-1);
      expect(service.current.bestWinStreak).toBe(1);

      service.recordRunStart(1, 1);
      service.recordRunEnd(false, 2);

      expect(service.current.currentStreak).toBe(-2);
    });

    it('should credit speciesVictoryCounts only on a win', () => {
      service.recordRunStart(1, 1);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 25 }));
      service.recordRunEnd(true, 8);

      expect(service.current.speciesVictoryCounts).toEqual({ 25: 1 });

      service.recordRunStart(1, 1);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 26 }));
      service.recordRunEnd(false, 3);

      expect(service.current.speciesVictoryCounts).toEqual({ 25: 1 });
    });
  });

  describe('scripted two-run fixture', () => {
    it('should reflect runs=2, victories=1, a named nemesis, a reset streak, and both teams in top-owned', () => {
      // Run 1: caught Bulbasaur as starter, lost to Brock.
      service.recordRunStart(1, 1);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1 }));
      service.recordBattleLoss('gym', 'gym:Brock');
      service.recordRunEnd(false, 1);

      // Run 2: team resets (MainGameComponent.resetTeam() on "play again"), caught
      // Charmander as starter, beat the champion.
      trainerService.resetTeam();
      service.recordRunStart(1, 4);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 4 }));
      service.recordBattleWin('champion');
      service.recordRunEnd(true, 16);

      const stats = service.current;
      expect(stats.runsPlayed).toBe(2);
      expect(stats.victories).toBe(1);
      expect(stats.defeats).toBe(1);
      expect(stats.currentStreak).toBe(1); // reset by the win after the loss
      expect(stats.nemesisDefeats).toEqual({ 'gym:Brock': 1 });
      expect(stats.speciesOwnedCounts).toEqual({ 1: 1, 4: 1 });
      expect(stats.starterCounts).toEqual({ 1: 1, 4: 1 });
    });
  });
});
