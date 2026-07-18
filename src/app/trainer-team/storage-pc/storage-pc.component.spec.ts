import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoragePcComponent } from './storage-pc.component';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import { bootstrapPcDisplayHorizontal } from '@ng-icons/bootstrap-icons';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { PokemonItem } from '../../interfaces/pokemon-item';

describe('StoragePcComponent', () => {
  let component: StoragePcComponent;
  let fixture: ComponentFixture<StoragePcComponent>;
  let trainerService: TrainerService;
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
      imports: [
        StoragePcComponent,
        NgIconsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideIcons({ bootstrapPcDisplayHorizontal }),
        {provide: HttpClient, useValue: httpSpyObj }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoragePcComponent);
    component = fixture.componentInstance;
    trainerService = TestBed.inject(TrainerService);
    trainerService.resetTeam();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Revive UI (game-balance-v4 Part B) ──────────────────────────────────

  describe('hasRevive / revivePokemon', () => {
    it('hasRevive is false with no revive item in inventory', () => {
      expect(component.hasRevive()).toBeFalse();
    });

    it('hasRevive is true once a revive item is in inventory', () => {
      trainerService.addToItems({ name: 'revive', text: 'items.revive.name', fillStyle: 'gold', weight: 1, description: '', sprite: '' } as any);
      expect(component.hasRevive()).toBeTrue();
    });

    it('revivePokemon does nothing without a revive item in inventory', () => {
      const fainted = makeTestPokemon({ fainted: true });
      component.trainerTeam = [];
      component.storedPokemon = [fainted];

      component.revivePokemon(fainted);

      expect(fainted.fainted).toBeTrue();
    });

    it('revivePokemon consumes the item and clears the fainted flag', () => {
      const revive = { name: 'revive', text: 'items.revive.name', fillStyle: 'gold', weight: 1, description: '', sprite: '' } as any;
      trainerService.addToItems(revive);
      const fainted = makeTestPokemon({ fainted: true });
      component.trainerTeam = [];
      component.storedPokemon = [fainted];

      component.revivePokemon(fainted);

      expect(fainted.fainted).toBeFalse();
      expect(trainerService.hasItem('revive')).toBeFalse();
    });
  });
});
