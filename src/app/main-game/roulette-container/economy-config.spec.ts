import {
  battleWinReward,
  cardCoinReward,
  randInt,
  CARD_COIN_MIN,
  CARD_COIN_MAX,
  WIN_BASE,
  WIN_PER_ROUND,
  INCOME_SCALE,
} from './economy-config';

describe('economy-config', () => {
  it('battleWinReward income-scales the round-0 base and the per-round slope', () => {
    expect(battleWinReward(0)).toBe(Math.round(WIN_BASE * INCOME_SCALE));
    expect(battleWinReward(4)).toBe(Math.round((WIN_BASE + 4 * WIN_PER_ROUND) * INCOME_SCALE));
    expect(battleWinReward(12)).toBe(Math.round((WIN_BASE + 12 * WIN_PER_ROUND) * INCOME_SCALE));
  });

  it('randInt stays within the inclusive bounds', () => {
    for (let i = 0; i < 200; i++) {
      const value = randInt(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      expect(Number.isInteger(value)).toBeTrue();
    }
  });

  it('randInt can hit both endpoints', () => {
    const spy = spyOn(Math, 'random');
    spy.and.returnValue(0);
    expect(randInt(3, 7)).toBe(3);
    spy.and.returnValue(0.999999);
    expect(randInt(3, 7)).toBe(7);
  });

  it('cardCoinReward stays within the configured card range', () => {
    for (let i = 0; i < 200; i++) {
      const value = cardCoinReward();
      expect(value).toBeGreaterThanOrEqual(CARD_COIN_MIN);
      expect(value).toBeLessThanOrEqual(CARD_COIN_MAX);
    }
  });
});
