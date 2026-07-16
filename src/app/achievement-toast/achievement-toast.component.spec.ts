import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AchievementToastComponent } from './achievement-toast.component';
import { StatsService } from '../services/stats-service/stats.service';

describe('AchievementToastComponent', () => {
  let component: AchievementToastComponent;
  let fixture: ComponentFixture<AchievementToastComponent>;
  let statsService: StatsService;

  beforeEach(async () => {
    localStorage.clear();
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } }));

    await TestBed.configureTestingModule({
      imports: [AchievementToastComponent, TranslateModule.forRoot()],
      providers: [{ provide: HttpClient, useValue: httpSpyObj }],
    }).compileComponents();

    fixture = TestBed.createComponent(AchievementToastComponent);
    component = fixture.componentInstance;
    statsService = TestBed.inject(StatsService);
    fixture.detectChanges();
  });

  it('should create with no toast showing', () => {
    expect(component).toBeTruthy();
    expect(component.current).toBeNull();
  });

  it('should show the first newly-unlocked achievement immediately', () => {
    statsService.recordShiny(); // unlocks first-shiny

    expect(component.current?.id).toBe('first-shiny');
    expect(component.queue.length).toBe(0);
  });

  it('should queue a second unlock behind the one currently showing, then reveal it on dismiss', () => {
    statsService.recordShiny(); // unlocks first-shiny (shown)
    statsService.recordLegendaryCaught(); // unlocks first-legendary (queued)

    expect(component.current?.id).toBe('first-shiny');
    expect(component.queue.map(a => a.id)).toEqual(['first-legendary']);

    component.dismiss();

    expect(component.current?.id).toBe('first-legendary');
    expect(component.queue.length).toBe(0);
  });
});
