import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import { bootstrapController, bootstrapCupHotFill, bootstrapPeopleFill } from '@ng-icons/bootstrap-icons';
import { TranslateModule } from '@ngx-translate/core';

import { StatsComponent } from './stats.component';
import { StatsService } from '../services/stats-service/stats.service';
import { TrainerService } from '../services/trainer-service/trainer.service';
import { PokemonItem } from '../interfaces/pokemon-item';

describe('StatsComponent', () => {
  let component: StatsComponent;
  let fixture: ComponentFixture<StatsComponent>;
  let statsService: StatsService;
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

  beforeEach(async () => {
    localStorage.clear();
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } }));

    await TestBed.configureTestingModule({
      imports: [
        StatsComponent,
        NgIconsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideIcons({ bootstrapController, bootstrapCupHotFill, bootstrapPeopleFill }),
        { provide: HttpClient, useValue: httpSpyObj },
      ]
    })
    .compileComponents();

    statsService = TestBed.inject(StatsService);
    trainerService = TestBed.inject(TrainerService);
    trainerService.resetTeam();

    fixture = TestBed.createComponent(StatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the empty state before any run has been played', () => {
    // No translation loader is configured in this spec, so the pipe renders the
    // raw i18n key — asserting on the key is equivalent to asserting the right
    // template branch rendered.
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('stats.empty');
    expect(text).not.toContain('stats.lifetime.runsPlayed');
  });

  it('should render lifetime totals once a run has completed', () => {
    statsService.recordRunStart(1, 1);
    trainerService.addToTeam(makeTestPokemon({ pokemonId: 1 }));
    statsService.recordBattleWin('champion');
    statsService.recordRunEnd(true, 12);

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('stats.empty');
    expect(text).toContain('stats.lifetime.runsPlayed');
    expect(text).toContain('1');
  });

  it('should format a win rate as a rounded percentage', () => {
    expect(component.formatRate(0.5)).toBe('50%');
    expect(component.formatRate(null)).toBe('—');
  });

  it('should look up a generation label from GenerationService', () => {
    expect(component.generationLabel(1)).toContain('Kanto');
  });

  describe('reset control', () => {
    it('should not reset stats just by opening the confirm modal', () => {
      statsService.recordRunStart(1, 1);
      statsService.recordRunEnd(false, 3);

      component.showResetConfirmModal();

      expect(statsService.current.runsPlayed).toBe(1);
    });

    it('should reset stats and close the modal on confirm', () => {
      statsService.recordRunStart(1, 1);
      statsService.recordRunEnd(false, 3);

      component.showResetConfirmModal();
      component.confirmReset();

      expect(statsService.current.runsPlayed).toBe(0);
    });

    it('should leave stats untouched if the reset is cancelled', () => {
      statsService.recordRunStart(1, 1);
      statsService.recordRunEnd(false, 3);

      component.showResetConfirmModal();
      component.closeModal();

      expect(statsService.current.runsPlayed).toBe(1);
    });
  });
});
