import { TestBed } from '@angular/core/testing';

import { DangerMeterService } from './danger-meter.service';

describe('DangerMeterService', () => {
  let service: DangerMeterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DangerMeterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to dangerPercent 5, consecutiveThreats 0, guaranteedRewardSteps 0', () => {
    expect(service.currentDangerPercent).toBe(5);
    expect(service.currentConsecutiveThreats).toBe(0);
    expect(service.currentGuaranteedRewardSteps).toBe(0);
  });

  it('rollStep should return "threat" and apply relief when the roll is below dangerPercent', () => {
    spyOn(Math, 'random').and.returnValue(0.01); // *100 = 1, below the initial 5% danger

    const step = service.rollStep(0);

    expect(step).toBe('threat');
    expect(service.currentDangerPercent).toBe(5); // max(FLOOR=5, 5 - RELIEF=20)
    expect(service.currentConsecutiveThreats).toBe(1);
  });

  it('rollStep should return "reward" and recover danger toward base(round) when the roll is above dangerPercent', () => {
    spyOn(Math, 'random').and.returnValue(0.5); // *100 = 50, above the initial 5% danger

    const step = service.rollStep(0);

    expect(step).toBe('reward');
    expect(service.currentDangerPercent).toBe(5); // recover(0): min(base(0)=5, 5+15)=5
    expect(service.currentConsecutiveThreats).toBe(0);
  });

  it('should follow the base(round) curve: 5, 10, 25, 50, 70, 70', () => {
    const spy = spyOn(Math, 'random').and.returnValue(0.99); // always reward, so dangerPercent settles at base(round)
    const rounds = [0, 1, 2, 3, 4, 5];
    const expected = [5, 10, 25, 50, 70, 70];

    rounds.forEach((round, i) => {
      // 65 is below the reward threshold (random*100=99) but high enough that
      // dangerPercent+RECOVERY(15)=80 >= base(round) for every round below, so
      // recover() is always capped by base(round), not by +RECOVERY.
      service.restore(65, 0);
      service.rollStep(round);
      expect(service.currentDangerPercent).toBe(expected[i]);
    });

    spy.and.stub();
  });

  it('should cap recovery at +RECOVERY per step even when base(round) is higher', () => {
    service.restore(5, 0);
    spyOn(Math, 'random').and.returnValue(0.99); // reward path

    service.rollStep(3); // base(3) = 50, but recovery is capped at +15

    expect(service.currentDangerPercent).toBe(20);
  });

  it('should hard-pity to a reward and reset consecutiveThreats after PITY consecutive threats', () => {
    spyOn(Math, 'random').and.returnValue(0.01); // would normally always be a threat

    expect(service.rollStep(0)).toBe('threat'); // consecutiveThreats -> 1
    expect(service.rollStep(0)).toBe('threat'); // consecutiveThreats -> 2
    expect(service.rollStep(0)).toBe('threat'); // consecutiveThreats -> 3 (== PITY)
    const fourth = service.rollStep(0); // PITY reached before this roll, forced reward instead

    expect(fourth).toBe('reward');
    expect(service.currentConsecutiveThreats).toBe(0);
  });

  it('isNextStepGuaranteedSafe should be true once consecutiveThreats reaches PITY - 1', () => {
    spyOn(Math, 'random').and.returnValue(0.01);

    expect(service.isNextStepGuaranteedSafe()).toBe(false);
    service.rollStep(0); // consecutiveThreats = 1
    expect(service.isNextStepGuaranteedSafe()).toBe(false);
    service.rollStep(0); // consecutiveThreats = 2 (PITY - 1)
    expect(service.isNextStepGuaranteedSafe()).toBe(true);
  });

  it('guaranteed reward steps should suppress the threat roll but still recover danger', () => {
    service.restore(70, 0); // high danger — would almost certainly roll a threat
    service.addGuaranteedRewardSteps(2);
    spyOn(Math, 'random').and.returnValue(0.01); // *100 = 1, well below 70% danger

    // First guaranteed step: forced reward despite the low roll, danger keeps climbing.
    expect(service.rollStep(3)).toBe('reward');
    expect(service.currentDangerPercent).toBe(50); // recover(3): min(base(3)=50, 70... capped by base) = 50
    expect(service.currentGuaranteedRewardSteps).toBe(1);
    expect(service.currentConsecutiveThreats).toBe(0);

    // Second (last) guaranteed step: still forced reward.
    expect(service.rollStep(3)).toBe('reward');
    expect(service.currentGuaranteedRewardSteps).toBe(0);

    // Burst exhausted: the low roll now produces a threat again.
    expect(service.rollStep(3)).toBe('threat');
  });

  it('addGuaranteedRewardSteps should stack additively (overlapping multitask bursts)', () => {
    service.addGuaranteedRewardSteps(2);
    service.addGuaranteedRewardSteps(2);
    expect(service.currentGuaranteedRewardSteps).toBe(4);
  });

  it('isNextStepGuaranteedSafe should be true while guaranteed reward steps remain', () => {
    expect(service.isNextStepGuaranteedSafe()).toBe(false);
    service.addGuaranteedRewardSteps(1);
    expect(service.isNextStepGuaranteedSafe()).toBe(true);
    spyOn(Math, 'random').and.returnValue(0.99);
    service.rollStep(0); // consumes the guaranteed step
    expect(service.isNextStepGuaranteedSafe()).toBe(false);
  });

  it('applySpike with no argument should add the default SPIKE amount, uncapped by base(round)', () => {
    service.restore(40, 1, 0);

    service.applySpike();

    expect(service.currentDangerPercent).toBe(70); // 40 + default SPIKE(30)
  });

  it('applySpike should accept a custom amount (e.g. tollBooth\'s scaled overdraft spike)', () => {
    service.restore(40, 1, 0);

    service.applySpike(10);

    expect(service.currentDangerPercent).toBe(50);
  });

  it('applySpike should cap dangerPercent at 100', () => {
    service.restore(95, 0, 0);

    service.applySpike();

    expect(service.currentDangerPercent).toBe(100);
  });

  it('resetForNewRun should restore the initial state', () => {
    service.restore(70, 2, 3);

    service.resetForNewRun();

    expect(service.currentDangerPercent).toBe(5);
    expect(service.currentConsecutiveThreats).toBe(0);
    expect(service.currentGuaranteedRewardSteps).toBe(0);
  });

  it('restore should set all fields without side effects', () => {
    service.restore(42, 2, 3);

    expect(service.currentDangerPercent).toBe(42);
    expect(service.currentConsecutiveThreats).toBe(2);
    expect(service.currentGuaranteedRewardSteps).toBe(3);
  });

  it('dangerPercent$ should emit the current dangerPercent on subscribe and on change', () => {
    const values: number[] = [];
    service.getStateObservable().subscribe(state => values.push(state.dangerPercent));

    spyOn(Math, 'random').and.returnValue(0.01);
    service.rollStep(0);

    expect(values).toEqual([5, 5]);
  });
});
