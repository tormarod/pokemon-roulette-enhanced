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
    expect(service.current.runHistory).toEqual([]);
    expect(service.current.firstPlayedAt).toBeNull();
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

  describe('per-generation breakdown (V3 §4)', () => {
    it('should fold species/type/nemesis into the *ByGen counters under the run\'s generation, alongside the lifetime ones', () => {
      service.recordRunStart(3, 1);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 25, type1: 'electric', type2: null }));
      service.recordBattleLoss('gym', 'gym:Brock');
      service.recordRunEnd(true, 7);

      expect(service.current.speciesOwnedCountsByGen).toEqual({ 3: { 25: 1 } });
      expect(service.current.typeCountsByGen).toEqual({ 3: { electric: 1 } });
      expect(service.current.nemesisDefeatsByGen).toEqual({ 3: { 'gym:Brock': 1 } });
      // Lifetime counters are still credited too, unchanged from before this feature.
      expect(service.current.speciesOwnedCounts).toEqual({ 25: 1 });
      expect(service.current.typeCounts).toEqual({ electric: 1 });
      expect(service.current.nemesisDefeats).toEqual({ 'gym:Brock': 1 });
    });

    it('should keep separate generations\' *ByGen counters independent', () => {
      service.recordRunStart(1, 1);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1, type1: 'grass', type2: null }));
      service.recordRunEnd(true, 5);

      service.recordRunStart(2, 4);
      trainerService.resetTeam();
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 4, type1: 'fire', type2: null }));
      service.recordRunEnd(true, 5);

      expect(service.current.speciesOwnedCountsByGen).toEqual({ 1: { 1: 1 }, 2: { 4: 1 } });
      expect(service.current.typeCountsByGen).toEqual({ 1: { grass: 1 }, 2: { fire: 1 } });
    });

    it('should not touch nemesisDefeatsByGen for a rival loss (no opponentKey)', () => {
      service.recordRunStart(1, 1);
      service.recordBattleLoss('rival');
      service.recordRunEnd(false, 3);

      expect(service.current.nemesisDefeatsByGen).toEqual({});
    });

    it('should not attribute species/types to any generation when recordRunEnd fires without a preceding recordRunStart', () => {
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1 }));
      service.recordRunEnd(true, 5);

      expect(service.current.speciesOwnedCountsByGen).toEqual({});
      expect(service.current.typeCountsByGen).toEqual({});
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

  describe('recordSpin / recordPotionUsed / recordStealSuffered', () => {
    it('should accumulate spin counts and the expected-probability sum', () => {
      service.recordSpin(true, 0.6);
      service.recordSpin(false, 0.4);

      expect(service.current.totalSpins).toBe(2);
      expect(service.current.yesLandings).toBe(1);
      expect(service.current.sumExpectedYesProbability).toBeCloseTo(1.0);
    });

    it('should increment potionsUsed on each call', () => {
      service.recordPotionUsed();
      service.recordPotionUsed();

      expect(service.current.potionsUsed).toBe(2);
    });

    it('should increment teamRocketStealsSuffered on each call', () => {
      service.recordStealSuffered();

      expect(service.current.teamRocketStealsSuffered).toBe(1);
    });
  });

  describe('run-history log + playtime timestamps', () => {
    /** Deterministic, monotonically increasing clock for run-log timing assertions. */
    const fakeClock = (start = 1000) => {
      let t = start;
      spyOn(service as any, 'now').and.callFake(() => t++);
    };

    it('should set firstPlayedAt on the first run only, and bump lastPlayedAt on every run end', () => {
      fakeClock();
      service.recordRunStart(1, 1);
      const firstPlayedAt = service.current.firstPlayedAt;
      service.recordRunEnd(true, 5);
      const lastPlayedAtAfterFirst = service.current.lastPlayedAt;

      service.recordRunStart(1, 4);
      service.recordRunEnd(false, 3);

      expect(firstPlayedAt).not.toBeNull();
      expect(service.current.firstPlayedAt).toBe(firstPlayedAt!);
      expect(service.current.lastPlayedAt).not.toBe(lastPlayedAtAfterFirst);
    });

    it('should append a run-history entry with the run\'s generation, starter, result and timing', () => {
      fakeClock();
      service.recordRunStart(3, 4);
      service.recordRunEnd(true, 12);

      expect(service.current.runHistory.length).toBe(1);
      expect(service.current.runHistory[0]).toEqual(jasmine.objectContaining({
        victory: true,
        generationId: 3,
        roundsReached: 12,
        starterPokemonId: 4,
      }));
      expect(service.current.runHistory[0].endedAt).toBeGreaterThan(service.current.runHistory[0].startedAt);
    });

    it('should append entries in chronological order, oldest first', () => {
      fakeClock();
      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 1);
      service.recordRunStart(1, 4);
      service.recordRunEnd(false, 2);
      service.recordRunStart(1, 7);
      service.recordRunEnd(true, 3);

      const history = service.current.runHistory;
      expect(history.map(run => run.starterPokemonId)).toEqual([1, 4, 7]);
      expect(history[0].startedAt).toBeLessThan(history[1].startedAt);
      expect(history[1].startedAt).toBeLessThan(history[2].startedAt);
    });

    it('should cap run-history at 30 entries, dropping the oldest first', () => {
      fakeClock();
      for (let i = 0; i < 31; i++) {
        service.recordRunStart(1, i);
        service.recordRunEnd(true, 1);
      }

      const history = service.current.runHistory;
      expect(history.length).toBe(30);
      // The very first run (starterPokemonId 0) should have been dropped; runs 1..30 remain.
      expect(history.map(run => run.starterPokemonId)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    });

    it('should not append a run-history entry if recordRunEnd is called without a preceding recordRunStart', () => {
      service.recordRunEnd(true, 5);

      expect(service.current.runHistory).toEqual([]);
    });
  });

  describe('recordLegendaryCaught / recordEvolutionPerformed', () => {
    it('should increment legendariesCaught on each call', () => {
      service.recordLegendaryCaught();
      service.recordLegendaryCaught();

      expect(service.current.legendariesCaught).toBe(2);
    });

    it('should increment evolutionsPerformed on each call', () => {
      service.recordEvolutionPerformed();

      expect(service.current.evolutionsPerformed).toBe(1);
    });
  });

  describe('recordBattleWin champion generationId + perfectRuns', () => {
    it('should mark the generation as champion-cleared only when a generationId is passed for a champion win', () => {
      service.recordBattleWin('champion', 3);
      service.recordBattleWin('gym');

      expect(service.current.championGenerationIds).toEqual({ 3: true });
    });

    it('should credit a perfect run when a victorious run had zero battle losses', () => {
      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 5);

      expect(service.current.perfectRuns).toBe(1);
    });

    it('should not credit a perfect run when the run had any battle loss, even if it was ultimately won', () => {
      service.recordRunStart(1, 1);
      service.recordBattleLoss('rival');
      service.recordRunEnd(true, 5);

      expect(service.current.perfectRuns).toBe(0);
    });

    it('should never credit a perfect run for a defeat', () => {
      service.recordRunStart(1, 1);
      service.recordRunEnd(false, 5);

      expect(service.current.perfectRuns).toBe(0);
    });

    it('should reset the per-run battle-loss count between runs', () => {
      service.recordRunStart(1, 1);
      service.recordBattleLoss('gym', 'gym:Brock');
      service.recordRunEnd(false, 3);

      service.recordRunStart(1, 4);
      service.recordRunEnd(true, 5);

      expect(service.current.perfectRuns).toBe(1);
    });
  });

  describe('achievement unlocking', () => {
    it('should unlock first-victory and emit it exactly once when the first run is won', () => {
      const unlocked: string[] = [];
      service.getAchievementUnlockedObservable().subscribe(achievement => unlocked.push(achievement.id));

      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 5);

      expect(service.current.unlockedAchievementIds['first-victory']).toBeTrue();
      expect(unlocked.filter(id => id === 'first-victory').length).toBe(1);

      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 5);

      expect(unlocked.filter(id => id === 'first-victory').length).toBe(1);
    });

    it('should unlock first-shiny as soon as recordShiny is called, independent of run boundaries', () => {
      service.recordShiny();

      expect(service.current.unlockedAchievementIds['first-shiny']).toBeTrue();
    });

    it('should unlock champion-every-generation only once every generation has been champion-cleared', () => {
      for (let genId = 1; genId <= 8; genId++) {
        service.recordBattleWin('champion', genId);
      }
      expect(service.current.unlockedAchievementIds['champion-every-generation']).toBeUndefined();

      service.recordBattleWin('champion', 9);

      expect(service.current.unlockedAchievementIds['champion-every-generation']).toBeTrue();
    });

    it('should unlock perfect-run only after a loss-free victory', () => {
      service.recordRunStart(1, 1);
      service.recordBattleLoss('rival');
      service.recordRunEnd(true, 5);
      expect(service.current.unlockedAchievementIds['perfect-run']).toBeUndefined();

      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 5);
      expect(service.current.unlockedAchievementIds['perfect-run']).toBeTrue();
    });
  });

  describe('per-section resets', () => {
    it('resetLuckStats should clear only luck/wheel fields, leaving other stats untouched', () => {
      service.recordSpin(true, 0.5);
      service.recordPotionUsed();
      service.recordStealSuffered();
      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 5);

      service.resetLuckStats();

      expect(service.current.totalSpins).toBe(0);
      expect(service.current.yesLandings).toBe(0);
      expect(service.current.sumExpectedYesProbability).toBe(0);
      expect(service.current.potionsUsed).toBe(0);
      expect(service.current.teamRocketStealsSuffered).toBe(0);
      expect(service.current.victories).toBe(1);
    });

    it('resetRunHistory should clear only the run-history log', () => {
      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 5);

      service.resetRunHistory();

      expect(service.current.runHistory).toEqual([]);
      expect(service.current.victories).toBe(1);
    });

    it('resetAchievements should clear unlocked ids without re-triggering an immediate re-unlock/toast', () => {
      const unlocked: string[] = [];
      service.getAchievementUnlockedObservable().subscribe(a => unlocked.push(a.id));

      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 5); // unlocks first-victory (and perfect-run)
      expect(service.current.unlockedAchievementIds['first-victory']).toBeTrue();

      service.resetAchievements();

      expect(service.current.unlockedAchievementIds).toEqual({});
      // resetAchievements bypasses unlock detection, so no new emission fires
      // even though victories/perfectRuns still satisfy the predicates.
      expect(unlocked.filter(id => id === 'first-victory').length).toBe(1);
    });
  });

  describe('exportStats / importStats', () => {
    it('should export the current stats as parseable JSON matching current state', () => {
      service.recordRunStart(2, 4);
      service.recordRunEnd(true, 9);

      const exported = JSON.parse(service.exportStats());

      expect(exported.victories).toBe(1);
      expect(exported.generationPlayCounts).toEqual({ 2: 1 });
    });

    it('should import a valid exported blob, replacing current stats', () => {
      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 5);
      const exported = service.exportStats();

      service.reset();
      expect(service.current.victories).toBe(0);

      const succeeded = service.importStats(exported);

      expect(succeeded).toBeTrue();
      expect(service.current.victories).toBe(1);
    });

    it('should normalize a partial/legacy imported blob rather than rejecting it', () => {
      const succeeded = service.importStats(JSON.stringify({ version: 1, runsPlayed: 3 }));

      expect(succeeded).toBeTrue();
      expect(service.current.runsPlayed).toBe(3);
      expect(service.current.victories).toBe(0);
    });

    it('should default the per-generation *ByGen fields to empty on a legacy blob predating V3', () => {
      const succeeded = service.importStats(JSON.stringify({ version: 1, runsPlayed: 3 }));

      expect(succeeded).toBeTrue();
      expect(service.current.speciesOwnedCountsByGen).toEqual({});
      expect(service.current.typeCountsByGen).toEqual({});
      expect(service.current.nemesisDefeatsByGen).toEqual({});
    });

    it('should round-trip *ByGen fields through export/import', () => {
      service.recordRunStart(3, 1);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 25, type1: 'electric', type2: null }));
      service.recordBattleLoss('gym', 'gym:Brock');
      service.recordRunEnd(true, 7);

      const exported = service.exportStats();
      service.reset();

      const succeeded = service.importStats(exported);

      expect(succeeded).toBeTrue();
      expect(service.current.speciesOwnedCountsByGen).toEqual({ 3: { 25: 1 } });
      expect(service.current.typeCountsByGen).toEqual({ 3: { electric: 1 } });
      expect(service.current.nemesisDefeatsByGen).toEqual({ 3: { 'gym:Brock': 1 } });
    });

    it('should fall back to an empty inner record for a malformed (non-object) *ByGen entry rather than crashing', () => {
      const succeeded = service.importStats(JSON.stringify({
        version: 1,
        speciesOwnedCountsByGen: { 3: 'not-an-object' },
      }));

      expect(succeeded).toBeTrue();
      expect(service.current.speciesOwnedCountsByGen).toEqual({ 3: {} });
    });

    it('should reject invalid JSON and leave current stats untouched', () => {
      service.recordRunStart(1, 1);
      service.recordRunEnd(true, 5);

      const succeeded = service.importStats('{not valid json');

      expect(succeeded).toBeFalse();
      expect(service.current.victories).toBe(1);
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
