import { TestBed } from '@angular/core/testing';
import { PokedexService, PokedexData } from './pokedex.service';

describe('PokedexService', () => {
  let service: PokedexService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PokedexService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // DATA-01: markSeen creates entry
  it('should create a caught entry when markSeen is called', () => {
    service.markSeen(1);
    expect(service.currentPokedex.caught['1']).toBeTruthy();
  });

  // DATA-01: idempotent
  it('should not duplicate caught entry when markSeen called twice for same id', () => {
    service.markSeen(1);
    service.markSeen(1);
    expect(Object.keys(service.currentPokedex.caught).length).toBe(1);
  });

  // DATA-02: markWon sets won:true
  it('should set won:true for all IDs when markWon is called', () => {
    service.markWon([1, 2]);
    expect(service.currentPokedex.caught['1'].won).toBeTrue();
    expect(service.currentPokedex.caught['2'].won).toBeTrue();
  });

  // DATA-02: markWon also marks unseen
  it('should mark unseen Pokémon as seen when markWon is called', () => {
    service.markWon([99]);
    expect(service.currentPokedex.caught['99']).toBeTruthy();
    expect(service.currentPokedex.caught['99'].won).toBeTrue();
  });

  // DATA-03: localStorage persistence on write
  it('should persist to localStorage after markSeen', () => {
    service.markSeen(25);
    const stored = JSON.parse(localStorage.getItem('pokemon-roulette-pokedex')!);
    expect(stored.caught['25']).toBeTruthy();
  });

  // DATA-03: Constructor reads from localStorage
  it('should restore state from localStorage on construction', () => {
    const saved: PokedexData = { version: 1, caught: { '4': { won: false, sprite: 'https://example.com/4.png' } } };
    localStorage.setItem('pokemon-roulette-pokedex', JSON.stringify(saved));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const newService = TestBed.inject(PokedexService);
    expect(newService.currentPokedex.caught['4']).toBeTruthy();
  });

  // DATA-03: Fallback to empty state on invalid JSON
  it('should fall back to empty caught when localStorage has invalid JSON', () => {
    const consoleErrorSpy = spyOn(console, 'error');
    localStorage.setItem('pokemon-roulette-pokedex', 'not-valid-json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const newService = TestBed.inject(PokedexService);
    expect(Object.keys(newService.currentPokedex.caught).length).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Invalid pokedex localStorage item:',
      'not-valid-json',
      'falling back to empty pokedex'
    );
  });

  // NORMALIZE-01: malformed individual entries are dropped, not the whole Pokédex
  it('should drop malformed entries on load while keeping valid ones', () => {
    localStorage.setItem(
      'pokemon-roulette-pokedex',
      JSON.stringify({ version: 1, caught: { '1': { won: true, sprite: 'https://example.com/1.png' }, '2': 'not-an-entry', '3': null } })
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const newService = TestBed.inject(PokedexService);

    expect(newService.currentPokedex.caught['1']).toBeTruthy();
    expect(newService.currentPokedex.caught['2']).toBeUndefined();
    expect(newService.currentPokedex.caught['3']).toBeUndefined();
  });

  // NORMALIZE-02: missing fields on an otherwise-valid entry default safely
  it('should default missing entry fields on load', () => {
    localStorage.setItem('pokemon-roulette-pokedex', JSON.stringify({ version: 1, caught: { '5': {} } }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const newService = TestBed.inject(PokedexService);

    expect(newService.currentPokedex.caught['5'].won).toBeFalse();
    expect(newService.currentPokedex.caught['5'].sprite).toBeNull();
  });

  // NORMALIZE-03: version is forced to the current version regardless of stored value
  it('should force the current version on load even if an older/newer value was stored', () => {
    localStorage.setItem('pokemon-roulette-pokedex', JSON.stringify({ version: 999, caught: {} }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const newService = TestBed.inject(PokedexService);

    expect(newService.currentPokedex.version).toBe(1);
  });

  // NORMALIZE-04: round-trip through save/load preserves data
  it('should round-trip caught entries through save and load', () => {
    service.markSeen(1);
    service.markWon([1]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const newService = TestBed.inject(PokedexService);

    expect(newService.currentPokedex.caught['1'].won).toBeTrue();
    expect(newService.currentPokedex.caught['1'].sprite).toBeTruthy();
  });

  // DATA-04: No reset method exists that could be wired to game loop
  it('should not have a clearPokedex method (reset-safety)', () => {
    expect((service as any)['clearPokedex']).toBeUndefined();
  });

  // DATA-05: Sprite URL stored on markSeen
  it('should store the deterministic sprite URL when markSeen is called', () => {
    service.markSeen(1);
    expect(service.currentPokedex.caught['1'].sprite).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png'
    );
  });

  // DATA-05: markWon on unseen also stores sprite
  it('should store sprite URL when markWon is called for unseen Pokémon', () => {
    service.markWon([7]);
    expect(service.currentPokedex.caught['7'].sprite).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png'
    );
  });

  // DATA-06: In-memory cache populated after markSeen
  it('should populate spriteCache after markSeen', () => {
    service.markSeen(4);
    expect((service as any)['spriteCache'].has(4)).toBeTrue();
  });

  // DATA-06: Idempotent cache (no duplicate entries)
  it('should not duplicate spriteCache entry when markSeen called twice', () => {
    service.markSeen(4);
    service.markSeen(4);
    expect((service as any)['spriteCache'].size).toBe(1);
  });

  // SHINY-01: shiny flag persistence
  it('should set shiny:true on entry when markSeen called with shiny=true — SHINY-01', () => {
    service.markSeen(25, true);
    expect(service.currentPokedex.caught['25'].shiny).toBeTrue();
  });

  it('should upgrade existing non-shiny entry to shiny when markSeen called with shiny=true — SHINY-01', () => {
    service.markSeen(25);
    service.markSeen(25, true);
    expect(service.currentPokedex.caught['25'].shiny).toBeTrue();
  });

  it('should not revert shiny flag once set — shiny=true is permanent — SHINY-01', () => {
    service.markSeen(25, true);
    service.markSeen(25, false);
    expect(service.currentPokedex.caught['25'].shiny).toBeTrue();
  });

  it('should preserve shiny flag after markWon is called — SHINY-01', () => {
    service.markSeen(25, true);
    service.markWon([25]);
    expect(service.currentPokedex.caught['25'].shiny).toBeTrue();
  });

  it('should propagate shiny to full family and forms when markSeen is called with shiny=true — SHINY-02', () => {
    service.markSeen(25, true);

    expect(service.currentPokedex.caught['172'].shiny).toBeTrue();
    expect(service.currentPokedex.caught['25'].shiny).toBeTrue();
    expect(service.currentPokedex.caught['26'].shiny).toBeTrue();
    expect(service.currentPokedex.caught['10100'].shiny).toBeTrue();
  });

  it('should propagate shiny from a form id to base and the whole family — SHINY-02', () => {
    service.markSeen(10100, true);

    expect(service.currentPokedex.caught['172'].shiny).toBeTrue();
    expect(service.currentPokedex.caught['25'].shiny).toBeTrue();
    expect(service.currentPokedex.caught['26'].shiny).toBeTrue();
    expect(service.currentPokedex.caught['10100'].shiny).toBeTrue();
  });

  it('should normalize shiny on load for existing related entries only and persist the migration — SHINY-03', () => {
    const saved: PokedexData = {
      version: 1,
      caught: {
        '25': { won: false, sprite: 'https://example.com/25.png', shiny: true },
        '26': { won: false, sprite: 'https://example.com/26.png' },
        '172': { won: false, sprite: 'https://example.com/172.png' },
      },
    };

    localStorage.setItem('pokemon-roulette-pokedex', JSON.stringify(saved));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const newService = TestBed.inject(PokedexService);

    expect(newService.currentPokedex.caught['25'].shiny).toBeTrue();
    expect(newService.currentPokedex.caught['26'].shiny).toBeTrue();
    expect(newService.currentPokedex.caught['172'].shiny).toBeTrue();
    expect(newService.currentPokedex.caught['10100']).toBeUndefined();

    const persisted = JSON.parse(localStorage.getItem('pokemon-roulette-pokedex')!);
    expect(persisted.caught['26'].shiny).toBeTrue();
    expect(persisted.caught['172'].shiny).toBeTrue();
    expect(persisted.caught['10100']).toBeUndefined();
  });

  // Observable: emits on subscribe (BehaviorSubject semantics)
  it('should emit current value immediately on pokedex$ subscribe', (done) => {
    service.pokedex$.subscribe(data => {
      expect(data).toBeTruthy();
      done();
    });
  });

  // Observable: emits after mutation
  it('should emit new value after markSeen', (done) => {
    let emitCount = 0;
    service.pokedex$.subscribe(data => {
      emitCount++;
      if (emitCount === 2) {
        expect(data.caught['10']).toBeTruthy();
        done();
      }
    });
    service.markSeen(10);
  });

  // ── Additional shiny edge cases ────────────────────────────────────────

  // Re-catch edge case: pokemon was already won; shiny upgrade must preserve won flag
  it('should preserve won:true when upgrading existing won entry to shiny — SHINY-EDGE-01', () => {
    service.markSeen(1);
    service.markWon([1]);

    // Simulate catching the same pokemon again via shiny roulette
    service.markSeen(1, true);

    const entry = service.currentPokedex.caught['1'];
    expect(entry.shiny).toBeTrue();
    expect(entry.won).toBeTrue();   // must be preserved — not reset by markSeen
    expect(entry.sprite).toBeTruthy(); // sprite must not be cleared
  });

  // Explicit false param: markSeen(id, false) must not revert an already-shiny entry
  it('should not revert shiny when markSeen is called with explicit shiny=false on shiny entry — SHINY-EDGE-02', () => {
    service.markSeen(7, true);
    expect(service.currentPokedex.caught['7'].shiny).toBeTrue();

    // Explicit false (not just omitted param) must not revert
    service.markSeen(7, false);

    expect(service.currentPokedex.caught['7'].shiny).toBeTrue();
  });

  // No-op re-catch: identical data must not trigger a pokedex$ emission
  it('should not emit a new pokedex$ value when markSeen is called with unchanged data — SHINY-EDGE-03', (done) => {
    // First call creates the entry and emits
    service.markSeen(50);

    let emitCount = 0;
    service.pokedex$.subscribe(() => {
      emitCount++;
    });

    // Second call with same id and same shiny=false → 'changed' is false → no updatePokedex call
    service.markSeen(50);
    service.markSeen(50, false);

    // Use setTimeout to let any pending async emissions drain before asserting
    setTimeout(() => {
      // emitCount === 1 because pokedex$ is a BehaviorSubject: emits current value on subscribe,
      // but does NOT emit again for the no-op markSeen calls
      expect(emitCount).toBe(1);
      done();
    }, 0);
  });

  // ── Shiny-family consistency pipeline tests ────────────────────────────────

  // PIPELINE-01: Write-path reveals the whole family
  it('should reveal whole evolution family when markSeen is called with shiny=true — PIPELINE-01', () => {
    service.markSeen(6, true);

    expect(service.currentPokedex.caught['4'].shiny).toBeTrue();
    expect(service.currentPokedex.caught['5'].shiny).toBeTrue();
    expect(service.currentPokedex.caught['6'].shiny).toBeTrue();
  });

  // PIPELINE-02: Non-shiny write does not propagate
  it('should not propagate when markSeen is called with shiny=false — PIPELINE-02', () => {
    service.markSeen(6, false);

    expect(service.currentPokedex.caught['6']).toBeTruthy();
    expect(service.currentPokedex.caught['6'].shiny).toBeUndefined();
    expect(service.currentPokedex.caught['4']).toBeUndefined();
    expect(service.currentPokedex.caught['5']).toBeUndefined();
  });

  // PIPELINE-03: Load enforcement flags existing family only
  it('should flag existing family only on load, not create new entries — PIPELINE-03', () => {
    const saved: PokedexData = {
      version: 1,
      caught: {
        '6': { won: false, sprite: 'https://example.com/6.png', shiny: true },
        '4': { won: false, sprite: 'https://example.com/4.png' },
      },
    };

    localStorage.setItem('pokemon-roulette-pokedex', JSON.stringify(saved));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const newService = TestBed.inject(PokedexService);

    expect(newService.currentPokedex.caught['4'].shiny).toBeTrue();
    expect(newService.currentPokedex.caught['5']).toBeUndefined();
    expect(newService.currentPokedex.caught['6'].shiny).toBeTrue();
  });

  // PIPELINE-04: Import enforcement
  it('should enforce consistency on replacePokedex — PIPELINE-04', () => {
    service.replacePokedex({
      version: 1,
      caught: {
        '6': { won: false, sprite: null, shiny: true },
        '4': { won: false, sprite: null },
      },
    });

    expect(service.currentPokedex.caught['4'].shiny).toBeTrue();
    expect(service.currentPokedex.caught['5']).toBeUndefined();
    expect(service.currentPokedex.caught['6'].shiny).toBeTrue();
  });

  // PIPELINE-05: Unrelated family untouched
  it('should not affect unrelated evolution families — PIPELINE-05', () => {
    service.markSeen(6, true);

    expect(service.currentPokedex.caught['1']).toBeUndefined();
    expect(service.currentPokedex.caught['2']).toBeUndefined();
    expect(service.currentPokedex.caught['3']).toBeUndefined();
  });
});
