import { TestBed } from '@angular/core/testing';

import { AdventureDrawService } from './adventure-draw.service';

describe('AdventureDrawService', () => {
  let service: AdventureDrawService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdventureDrawService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default getPendingDraw to null', () => {
    expect(service.getPendingDraw()).toBeNull();
  });

  it('should commit a draw with picked null', () => {
    service.commitDraw('reward', ['catchPokemon', 'findItem', 'battleRival']);

    expect(service.getPendingDraw()).toEqual({
      stepType: 'reward', candidates: ['catchPokemon', 'findItem', 'battleRival'], picked: null
    });
  });

  it('should commit a pick onto the existing draw', () => {
    service.commitDraw('reward', ['catchPokemon', 'findItem', 'battleRival']);

    service.commitPick(2);

    expect(service.getPendingDraw()).toEqual({
      stepType: 'reward', candidates: ['catchPokemon', 'findItem', 'battleRival'], picked: 2
    });
  });

  it('should no-op commitPick when there is no pending draw', () => {
    service.commitPick(1);

    expect(service.getPendingDraw()).toBeNull();
  });

  it('should clear the draw', () => {
    service.commitDraw('threat', ['a', 'b', 'c']);

    service.clearDraw();

    expect(service.getPendingDraw()).toBeNull();
  });

  it('should restore a draw', () => {
    service.restoreDraw({ stepType: 'reward', candidates: ['a', 'b', 'c'], picked: 1 });

    expect(service.getPendingDraw()).toEqual({ stepType: 'reward', candidates: ['a', 'b', 'c'], picked: 1 });
  });

  it('should restore null', () => {
    service.commitDraw('reward', ['a', 'b', 'c']);

    service.restoreDraw(null);

    expect(service.getPendingDraw()).toBeNull();
  });
});
