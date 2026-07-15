import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainGameComponent } from './main-game.component';
import { NgIconsModule, provideIcons } from '@ng-icons/core';
import { HttpClient } from '@angular/common/http';
import {
  bootstrapArrowRepeat,
  bootstrapBook,
  bootstrapCheck,
  bootstrapClock,
  bootstrapCupHotFill,
  bootstrapGear,
  bootstrapPcDisplayHorizontal,
  bootstrapShare,
} from '@ng-icons/bootstrap-icons';
import { TranslateModule } from '@ngx-translate/core';
import { AnalyticsService } from '../services/analytics-service/analytics.service';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { TypeBiasItemService } from '../services/type-bias-item-service/type-bias-item.service';

describe('MainGameComponent', () => {
  let component: MainGameComponent;
  let fixture: ComponentFixture<MainGameComponent>;
  let httpSpy: jasmine.SpyObj<HttpClient>;
  let analyticsServiceSpy: jasmine.SpyObj<AnalyticsService>;
  let gameStateService: GameStateService;

  beforeEach(async () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    const analyticsServiceSpyObj = jasmine.createSpyObj('AnalyticsService', ['trackEvent']);

    await TestBed.configureTestingModule({
      imports: [
        MainGameComponent,
        NgIconsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideIcons({
          bootstrapShare,
          bootstrapClock,
          bootstrapArrowRepeat,
          bootstrapBook,
          bootstrapGear,
          bootstrapCupHotFill,
          bootstrapCheck,
          bootstrapPcDisplayHorizontal,
        }),
        {provide: HttpClient, useValue: httpSpyObj },
        { provide: AnalyticsService, useValue: analyticsServiceSpyObj }
      ],
    })
    .compileComponents();

    httpSpy = TestBed.inject(HttpClient) as jasmine.SpyObj<HttpClient>;
    analyticsServiceSpy = TestBed.inject(AnalyticsService) as jasmine.SpyObj<AnalyticsService>;
    gameStateService = TestBed.inject(GameStateService);
    fixture = TestBed.createComponent(MainGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Items unavailable before the adventure starts ───────────────────────

  it('should not make items available at game-start', () => {
    expect(component.itemsAvailable).toBeFalse();
  });

  it('should not render the Items panel before the adventure starts', () => {
    expect(fixture.nativeElement.querySelector('app-items')).toBeNull();
  });

  it('should make items available once the game reaches start-adventure', () => {
    // Natural stack drain (no manual setNextState): character-select -> starter-pokemon -> start-adventure.
    gameStateService.finishCurrentState();
    gameStateService.finishCurrentState();
    gameStateService.finishCurrentState();
    fixture.detectChanges();

    expect(component.itemsAvailable).toBeTrue();
    expect(fixture.nativeElement.querySelector('app-items')).not.toBeNull();
  });

  it('should keep items available on a later check-shininess triggered by catching a Pokemon mid-run', () => {
    // check-shininess is reused for every catch, not just the starter — reaching it again
    // after the adventure has started must not hide the items panel.
    gameStateService.finishCurrentState();
    gameStateService.finishCurrentState();
    gameStateService.finishCurrentState();
    gameStateService.setNextState('check-shininess');
    gameStateService.finishCurrentState();
    fixture.detectChanges();

    expect(component.itemsAvailable).toBeTrue();
    expect(fixture.nativeElement.querySelector('app-items')).not.toBeNull();
  });

  it('should ignore a typeBiasItemInterrupt while items are unavailable', () => {
    const typeBiasItemService = TestBed.inject(TypeBiasItemService);
    spyOn(typeBiasItemService, 'triggerTypeBiasItem');
    const honey: any = { name: 'honey', text: '', fillStyle: '', weight: 1, description: '', sprite: '' };

    component.typeBiasItemInterrupt(honey);

    expect(typeBiasItemService.triggerTypeBiasItem).not.toHaveBeenCalled();
  });
});
