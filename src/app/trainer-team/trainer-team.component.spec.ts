import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrainerTeamComponent } from './trainer-team.component';
import { HttpClient } from '@angular/common/http';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import { bootstrapBook, bootstrapPcDisplayHorizontal } from '@ng-icons/bootstrap-icons';
import { TranslateModule } from '@ngx-translate/core';
import { TrainerService } from '../services/trainer-service/trainer.service';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { MarkedTargetService } from '../services/marked-target-service/marked-target.service';
import { PokemonItem } from '../interfaces/pokemon-item';

describe('TrainerTeamComponent', () => {
  let component: TrainerTeamComponent;
  let fixture: ComponentFixture<TrainerTeamComponent>;
  let httpSpy: jasmine.SpyObj<HttpClient>;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let markedTargetService: MarkedTargetService;

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
        TrainerTeamComponent,
        NgIconsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideIcons({ bootstrapPcDisplayHorizontal, bootstrapBook }),
        {provide: HttpClient, useValue: httpSpyObj }
      ]
    })
    .compileComponents();

    trainerService = TestBed.inject(TrainerService);
    trainerService.resetTeam();
    gameStateService = TestBed.inject(GameStateService);
    markedTargetService = TestBed.inject(MarkedTargetService);
    markedTargetService.clearMark();

    fixture = TestBed.createComponent(TrainerTeamComponent);
    component = fixture.componentInstance;
    component.trainer = { sprite: './place-holder-pixel.png' };
    component.trainerBadges = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Marked Target / ability status badges (New Experience only) ─────────

  describe('status badges on the team strip', () => {
    beforeEach(() => {
      gameStateService.restoreNewExperienceMode(true);
    });

    it('shows the marked badge only on the team member at the marked index', () => {
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1 }));
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 4 }));
      markedTargetService.setMark(0);
      fixture.detectChanges();

      const tiles = fixture.nativeElement.querySelectorAll('.pokemon-container');
      expect(tiles[0].querySelector('.marked-badge')).toBeTruthy();
      expect(tiles[1].querySelector('.marked-badge')).toBeFalsy();
    });

    it('shows no marked badge when nothing is marked', () => {
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1 }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.marked-badge')).toBeFalsy();
    });

    it('shows the ability badge for a team member with an assigned ability', () => {
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1, ability: 'sturdy' }));
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.ability-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('abilities.sturdy.name');
    });

    it('getMemberAbilityName returns the ability i18n name key (or null)', () => {
      expect(component.getMemberAbilityName(makeTestPokemon({ ability: 'sturdy' }))).toBe('abilities.sturdy.name');
      expect(component.getMemberAbilityName(makeTestPokemon())).toBeNull();
      expect(component.getMemberAbilityName(undefined)).toBeNull();
    });

    it('hides marked/ability badges in Classic mode even if the underlying data is set', () => {
      gameStateService.restoreNewExperienceMode(false);
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 1, ability: 'sturdy' }));
      markedTargetService.setMark(0);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.marked-badge')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('.ability-badge')).toBeFalsy();
    });
  });
});
