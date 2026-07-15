import { TestBed } from '@angular/core/testing';

import { PendingSpinService } from './pending-spin.service';

describe('PendingSpinService', () => {
  const PENDING_SPIN_KEY = 'pokemon-roulette-pending-spin';

  let service: PendingSpinService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PendingSpinService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should commit a pending spin to localStorage', () => {
    service.commitPendingSpin('game.main.roulette.gym.yes');

    expect(localStorage.getItem(PENDING_SPIN_KEY)).toBe('game.main.roulette.gym.yes');
  });

  it('should consume a pending spin exactly once', () => {
    service.commitPendingSpin('game.main.roulette.gym.yes');

    expect(service.consumePendingSpin()).toBe('game.main.roulette.gym.yes');
    expect(service.consumePendingSpin()).toBeNull();
  });

  it('clearPendingSpin should remove a pending spin without needing to consume it', () => {
    service.commitPendingSpin('game.main.roulette.gym.no');
    service.clearPendingSpin();

    expect(localStorage.getItem(PENDING_SPIN_KEY)).toBeNull();
    expect(service.consumePendingSpin()).toBeNull();
  });

  it('should return null when nothing is pending', () => {
    expect(service.consumePendingSpin()).toBeNull();
  });
});
