import { SOFT_WHEEL_PALETTE, softenWheelColor } from './wheel-palette';

describe('wheel palette', () => {
  it('maps named producer colors to harmonized hexes', () => {
    expect(softenWheelColor('green')).toBe('#2e7d32');
    expect(softenWheelColor('crimson')).toBe('#c0392b');
    expect(softenWheelColor('darkorange')).toBe('#e67e22');
  });

  it('passes through hex and unknown values untouched', () => {
    expect(softenWheelColor('#FFD700')).toBe('#FFD700');
    expect(softenWheelColor('#A8A77A')).toBe('#A8A77A');
    expect(softenWheelColor('not-a-color')).toBe('not-a-color');
    expect(softenWheelColor('')).toBe('');
  });

  it('covers every named color used by wheel-item producers', () => {
    const producerColors = [
      'green', 'blue', 'crimson', 'darkred', 'black', 'red', 'purple', 'gray',
      'goldenrod', 'brown', 'yellow', 'darkorange', 'darkblue', 'pink',
      'deeppink', 'darkgreen', 'white', 'darkcyan', 'darkgoldenrod',
      'darkviolet', 'cyan', 'saddlebrown', 'orange', 'gold', 'darkslategray',
      'teal', 'indigo', 'darkslateblue', 'darkgray', 'silver',
      'mediumvioletred', 'maroon', 'lime', 'darkmagenta',
    ];
    for (const color of producerColors) {
      expect(SOFT_WHEEL_PALETTE[color]).withContext(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
