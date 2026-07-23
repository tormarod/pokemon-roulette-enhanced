import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { RunStatusHeaderComponent } from './run-status-header.component';
import { GymLeader } from '../../interfaces/gym-leader';

describe('RunStatusHeaderComponent', () => {
  let fixture: ComponentFixture<RunStatusHeaderComponent>;

  const brock: GymLeader = {
    name: 'game.trainers.brock',
    sprite: 'brock.png',
    quotes: [],
    types: ['rock']
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RunStatusHeaderComponent, TranslateModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(RunStatusHeaderComponent);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the next-up row with one type icon per opponent type', () => {
    fixture.componentRef.setInput('opponent', brock);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.status-next-up')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.status-next-types img').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.status-next-note')).toBeFalsy();
  });

  it('should show the "one of" note only for multi-type opponents', () => {
    fixture.componentRef.setInput('opponent', { ...brock, types: ['rock', 'ground'] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.status-next-types img').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.status-next-note')).toBeTruthy();
  });

  it('should hide the next-up row when there is no opponent', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.status-next-up')).toBeFalsy();
  });

  it('should render the danger meter only when showDanger is true', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-danger-meter')).toBeFalsy();

    fixture.componentRef.setInput('showDanger', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-danger-meter')).toBeTruthy();
  });

  it('should render the prompt line only when promptKeys is non-empty', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.status-prompt')).toBeFalsy();

    fixture.componentRef.setInput('promptKeys', ['game.main.roulette.adventure.title']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.status-prompt')).toBeTruthy();
  });

  it('should render one span per prompt key plus the raw suffix', () => {
    fixture.componentRef.setInput('promptKeys', ['game.main.roulette.catch.which', 'game.main.roulette.catch.pkmn']);
    fixture.componentRef.setInput('promptSuffix', '(Red / Blue / Yellow)');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.status-prompt span').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.status-prompt').textContent).toContain('(Red / Blue / Yellow)');
  });
});
