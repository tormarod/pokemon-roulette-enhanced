import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WheelComponent } from './wheel.component';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsService } from '../services/settings-service/settings.service';

describe('WheelComponent', () => {
  const sigmaTolerance = (p: number, runs: number, sigma = 4) => sigma * Math.sqrt((p * (1 - p)) / runs);
  const PENDING_SPIN_KEY = 'pokemon-roulette-pending-spin';

  let component: WheelComponent;
  let fixture: ComponentFixture<WheelComponent>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [WheelComponent, TranslateModule.forRoot()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WheelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have a fair distribuition of chances', () => {
    const numRuns = 10000;
    const expectedProbability = 1 / 8;
    const tolerance = sigmaTolerance(expectedProbability, numRuns);

    component.items = [
      { text: '1', weight: 1, fillStyle: 'red' },
      { text: '2', weight: 1, fillStyle: 'green' },
      { text: '3', weight: 1, fillStyle: 'blue' },
      { text: '4', weight: 1, fillStyle: 'yellow' },
      { text: '5', weight: 1, fillStyle: 'orange' },
      { text: '6', weight: 1, fillStyle: 'black' },
      { text: '7', weight: 1, fillStyle: 'purple' },
      { text: '8', weight: 1, fillStyle: 'pink' }
    ];
    (component as any).translatedItems = component.items;

    const results: number[] = new Array(component.items.length).fill(0);

    for (let i = 0; i < numRuns; i++) {
      const result = component.getRandomWeightedIndex();
      results[result]++;
    }

    const probabilities = results.map(result => result / numRuns);

    for (let i = 0; i < probabilities.length; i++) {
      expect(Math.abs(probabilities[i] - expectedProbability)).toBeLessThan(tolerance);
    }
  });

  it('should have a fair distribuition for large numbers of elements', () => {
    const numRuns = 100000;
    const expectedProbability = 1 / 150;
    const tolerance = sigmaTolerance(expectedProbability, numRuns, 5);

    component.items = [];
    const possibleColors = ['red', 'green', 'blue', 'yellow', 'orange', 'black', 'purple', 'pink'];

    for (let i = 1; i <= 150; i++) {
      const color = possibleColors[Math.floor(Math.random() * possibleColors.length)];
      component.items.push({ text: `${i}`, weight: 1, fillStyle: color });
    }
    (component as any).translatedItems = component.items;

    const results: number[] = new Array(component.items.length).fill(0);
    const occurrences: number[] = new Array(component.items.length).fill(0);

    for (let i = 0; i < numRuns; i++) {
      const result = component.getRandomWeightedIndex();
      results[result]++;
      occurrences[result]++;
    }

    const probabilities = results.map(result => result / numRuns);

    const meanProbability = probabilities.reduce((sum, probability) => sum + probability, 0) / probabilities.length;
    expect(Math.abs(meanProbability - expectedProbability)).toBeLessThan(tolerance);

    for (let i = 0; i < probabilities.length; i++) {
      expect(Math.abs(probabilities[i] - expectedProbability)).toBeLessThan(tolerance);
    }
  });

  it('the distribuition should respect the weight', () => {
    const numRuns = 10000;
    const expectedForLower = 1 / 14;
    const expectedForHigher = 1 / 2;
    const lowerTolerance = sigmaTolerance(expectedForLower, numRuns, 4);
    const higherTolerance = sigmaTolerance(expectedForHigher, numRuns, 4);

    component.items = [
      { text: '1', weight: 7, fillStyle: 'red' },
      { text: '2', weight: 1, fillStyle: 'green' },
      { text: '3', weight: 1, fillStyle: 'blue' },
      { text: '4', weight: 1, fillStyle: 'yellow' },
      { text: '5', weight: 1, fillStyle: 'orange' },
      { text: '6', weight: 1, fillStyle: 'black' },
      { text: '7', weight: 1, fillStyle: 'purple' },
      { text: '8', weight: 1, fillStyle: 'pink' }
    ];
    (component as any).translatedItems = component.items;

    const results: number[] = new Array(component.items.length).fill(0);

    for (let i = 0; i < numRuns; i++) {
      const result = component.getRandomWeightedIndex();
      results[result]++;
    }

    const probabilities = results.map(result => result / numRuns);

    expect(Math.abs(probabilities[0] - expectedForHigher)).toBeLessThan(higherTolerance);

    for (let i = 1; i < probabilities.length; i++) {
      expect(Math.abs(probabilities[i] - expectedForLower)).toBeLessThan(lowerTolerance);
    }
  });

  // ── Pending-spin exploit-proofing: outcome locks in at click time ──────────

  it('should commit a pending spin the instant spinWheel is called, before the animation resolves', () => {
    component.items = [
      { text: 'a', weight: 1, fillStyle: 'red' },
      { text: 'b', weight: 1, fillStyle: 'blue' },
    ];
    (component as any).translatedItems = component.items;
    const pendingSpinService = (component as any).pendingSpinService;
    spyOn(pendingSpinService, 'commitPendingSpin');

    component.spinWheel();

    expect(pendingSpinService.commitPendingSpin)
      .toHaveBeenCalledWith(component.items[component.winningNumber].text);
  });

  it('should clear the pending spin once a spin resolves normally', () => {
    component.items = [
      { text: 'a', weight: 1, fillStyle: 'red' },
    ];
    (component as any).translatedItems = component.items;
    (component as any).duration = 0;
    const pendingSpinService = (component as any).pendingSpinService;
    spyOn(pendingSpinService, 'clearPendingSpin');

    (component as any).startTime = performance.now() - 1;
    (component as any).finalRotation = 0;
    (component as any).winningNumber = 0;
    (component as any).animate(performance.now());

    expect(pendingSpinService.clearPendingSpin).toHaveBeenCalled();
  });

  it('should resolve an already-committed pending spin on init instead of animating a fresh spin', () => {
    localStorage.setItem(PENDING_SPIN_KEY, 'b');

    const freshFixture = TestBed.createComponent(WheelComponent);
    const freshComponent = freshFixture.componentInstance;
    freshComponent.items = [
      { text: 'a', weight: 1, fillStyle: 'red' },
      { text: 'b', weight: 1, fillStyle: 'blue' },
    ];
    spyOn(freshComponent.selectedItemEvent, 'emit');

    freshFixture.detectChanges();

    expect(freshComponent.selectedItemEvent.emit).toHaveBeenCalledWith(1);
    expect(localStorage.getItem(PENDING_SPIN_KEY)).toBeNull();
  });

  it('should not resolve a pending spin whose text no longer matches any current item', () => {
    localStorage.setItem(PENDING_SPIN_KEY, 'no-such-item');

    const freshFixture = TestBed.createComponent(WheelComponent);
    const freshComponent = freshFixture.componentInstance;
    freshComponent.items = [
      { text: 'a', weight: 1, fillStyle: 'red' },
    ];
    spyOn(freshComponent.selectedItemEvent, 'emit');

    freshFixture.detectChanges();

    expect(freshComponent.selectedItemEvent.emit).not.toHaveBeenCalled();
  });

  // ── Fast-spin setting ────────────────────────────────────────────────────

  it('should shorten the spin duration when fastSpin is enabled', () => {
    const settingsService = TestBed.inject(SettingsService);
    settingsService.toggleFastSpin();
    component.items = [{ text: 'a', weight: 1, fillStyle: 'red' }];
    (component as any).translatedItems = component.items;

    component.spinWheel();

    expect(component.duration).toBe(400);
  });

  it('should use a normal (un-shortened) spin duration when fastSpin is disabled', () => {
    const settingsService = TestBed.inject(SettingsService);
    expect(settingsService.currentSettings.fastSpin).toBeFalse();
    component.items = [{ text: 'a', weight: 1, fillStyle: 'red' }];
    (component as any).translatedItems = component.items;

    component.spinWheel();

    // Not the fast-spin value, and within the normal 3000–5000ms range.
    expect(component.duration).not.toBe(400);
    expect(component.duration).toBeGreaterThanOrEqual(3000);
    expect(component.duration).toBeLessThan(5000);
  });

  it('should restore a normal duration on a later spin after fastSpin is turned back off', () => {
    const settingsService = TestBed.inject(SettingsService);
    component.items = [{ text: 'a', weight: 1, fillStyle: 'red' }];
    (component as any).translatedItems = component.items;

    settingsService.toggleFastSpin();
    component.spinning = false;
    component.spinWheel();
    expect(component.duration).toBe(400);

    // Turning Fast Spin back off must not leave the shortened duration stuck.
    settingsService.toggleFastSpin();
    component.spinning = false;
    component.spinWheel();
    expect(component.duration).not.toBe(400);
    expect(component.duration).toBeGreaterThanOrEqual(3000);
  });
});
