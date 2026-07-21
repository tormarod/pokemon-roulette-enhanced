import { TestBed } from '@angular/core/testing';

import { ScoutingReportService } from './scouting-report.service';

describe('ScoutingReportService', () => {
  let service: ScoutingReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScoutingReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default currentType to null', () => {
    expect(service.currentType).toBeNull();
  });

  it('should set the pending type', () => {
    service.setType('fire');
    expect(service.currentType).toBe('fire');
  });

  it('should clear the pending type back to null', () => {
    service.setType('fire');
    service.clearType();
    expect(service.currentType).toBeNull();
  });

  it('should restore a pending type', () => {
    service.restoreType('water');
    expect(service.currentType).toBe('water');
  });

  it('should emit through getPendingTypeObservable', () => {
    const values: (string | null)[] = [];
    service.getPendingTypeObservable().subscribe(v => values.push(v));

    service.setType('fire');
    service.clearType();

    expect(values).toEqual([null, 'fire', null]);
  });
});
