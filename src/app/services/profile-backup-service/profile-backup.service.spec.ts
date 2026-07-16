import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ProfileBackupService, PROFILE_BUNDLE_KIND, PROFILE_BUNDLE_VERSION } from './profile-backup.service';
import { StatsService } from '../stats-service/stats.service';
import { PokedexService } from '../pokedex-service/pokedex.service';

describe('ProfileBackupService', () => {
  let service: ProfileBackupService;
  let statsService: StatsService;
  let pokedexService: PokedexService;

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
    service = TestBed.inject(ProfileBackupService);
    statsService = TestBed.inject(StatsService);
    pokedexService = TestBed.inject(PokedexService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should export a bundle with the expected kind/bundleVersion and both stores', () => {
    statsService.recordRunStart(2, 4);
    statsService.recordRunEnd(true, 9);
    pokedexService.markSeen(25);

    const exported = JSON.parse(service.exportProfile());

    expect(exported.kind).toBe(PROFILE_BUNDLE_KIND);
    expect(exported.bundleVersion).toBe(PROFILE_BUNDLE_VERSION);
    expect(exported.stores.stats.data.victories).toBe(1);
    expect(exported.stores.pokedex.data.caught['25']).toBeTruthy();
  });

  it('should round-trip export -> import, restoring both stats and Pokédex', () => {
    statsService.recordRunStart(1, 1);
    statsService.recordRunEnd(true, 5);
    pokedexService.markWon([1]);
    const exported = service.exportProfile();

    statsService.reset();
    expect(statsService.current.victories).toBe(0);

    const result = service.importProfile(exported);

    expect(result).toBe('success');
    expect(statsService.current.victories).toBe(1);
    expect(pokedexService.currentPokedex.caught['1'].won).toBeTrue();
  });

  it('should reject a bundle with the wrong kind', () => {
    const result = service.importProfile(JSON.stringify({ kind: 'something-else', bundleVersion: 1, stores: {} }));
    expect(result).toBe('invalid');
  });

  it('should reject invalid JSON', () => {
    const result = service.importProfile('{not valid json');
    expect(result).toBe('invalid');
  });

  it('should reject a bare V2 stats-only export (no kind field)', () => {
    const result = service.importProfile(statsService.exportStats());
    expect(result).toBe('invalid');
  });

  it('should reject a bundleVersion newer than this app understands, leaving current data untouched', () => {
    statsService.recordRunStart(1, 1);
    statsService.recordRunEnd(true, 5);

    const result = service.importProfile(JSON.stringify({
      kind: PROFILE_BUNDLE_KIND,
      bundleVersion: PROFILE_BUNDLE_VERSION + 1,
      stores: { stats: { version: 1, data: { victories: 999 } }, pokedex: { version: 1, data: { caught: {} } } },
    }));

    expect(result).toBe('unsupported-version');
    expect(statsService.current.victories).toBe(1);
  });

  it('should normalize malformed store data on import rather than crashing', () => {
    const result = service.importProfile(JSON.stringify({
      kind: PROFILE_BUNDLE_KIND,
      bundleVersion: 1,
      stores: { stats: { version: 1, data: { runsPlayed: 'not-a-number' } }, pokedex: { version: 1, data: { caught: { '1': 'bad-entry' } } } },
    }));

    expect(result).toBe('success');
    expect(statsService.current.runsPlayed).toBe(0);
    expect(pokedexService.currentPokedex.caught['1']).toBeUndefined();
  });
});
