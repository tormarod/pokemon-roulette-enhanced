import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoragePcComponent } from './storage-pc.component';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import { bootstrapPcDisplayHorizontal } from '@ng-icons/bootstrap-icons';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { AbilityId } from '../../services/ability-service/abilities-data';

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

  // ── Ability assignment (New Experience) ─────────────────────────────────

  describe('ability assignment', () => {
    let gameStateService: GameStateService;

    const addCapsule = (abilityId: AbilityId) =>
      trainerService.addToItems({
        name: `capsule-${abilityId}`, text: `abilities.${abilityId}.name`,
        description: `abilities.${abilityId}.description`, fillStyle: 'red',
        weight: 1, sprite: '', abilityId
      } as any);

    beforeEach(() => {
      gameStateService = TestBed.inject(GameStateService);
      gameStateService.restoreNewExperienceMode(true);
    });

    it('ownedCapsules returns only ability-capsule items', () => {
      trainerService.addToItems({ name: 'potion', text: '', description: '', fillStyle: '', weight: 1, sprite: '' } as any);
      addCapsule('blaze');
      const owned = component.ownedCapsules();
      expect(owned.length).toBe(1);
      expect(owned[0].abilityId).toBe('blaze');
    });

    it('getMemberAbilityName returns the ability i18n name key (or null)', () => {
      expect(component.getMemberAbilityName(makeTestPokemon({ ability: 'sturdy' }))).toBe('abilities.sturdy.name');
      expect(component.getMemberAbilityName(makeTestPokemon())).toBeNull();
    });

    it('assignAbility sets the ability, consumes the capsule, and persists', () => {
      trainerService.addToTeam(makeTestPokemon());
      component.trainerTeam = trainerService.getTeam();
      component.storedPokemon = trainerService.getStored();
      addCapsule('blaze');
      component.assignTarget = component.trainerTeam[0];

      component.assignAbility(component.ownedCapsules()[0]);

      expect(component.trainerTeam[0].ability).toBe('blaze');
      expect(component.ownedCapsules().length).toBe(0);
      expect(trainerService.getTeam()[0].ability).toBe('blaze');
    });

    it('assigning a second capsule overwrites the first', () => {
      const mon = makeTestPokemon();
      component.trainerTeam = [mon];
      component.storedPokemon = [];
      addCapsule('blaze');
      addCapsule('torrent');

      component.assignTarget = mon;
      component.assignAbility(component.ownedCapsules().find(c => c.abilityId === 'blaze')!);
      expect(mon.ability).toBe('blaze');

      component.assignTarget = mon;
      component.assignAbility(component.ownedCapsules().find(c => c.abilityId === 'torrent')!);
      expect(mon.ability).toBe('torrent');
    });

    it('does not assign or consume in Classic mode', () => {
      gameStateService.restoreNewExperienceMode(false);
      const mon = makeTestPokemon();
      component.trainerTeam = [mon];
      component.storedPokemon = [];
      addCapsule('blaze');
      component.assignTarget = mon;

      component.assignAbility(component.ownedCapsules()[0]);

      expect(mon.ability).toBeUndefined();
      expect(component.ownedCapsules().length).toBe(1);
    });
  });
});
