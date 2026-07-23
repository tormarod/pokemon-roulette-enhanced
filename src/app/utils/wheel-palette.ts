/**
 * Harmonized wheel-slice palette. Producers keep using CSS named colors as
 * stable identifiers; this map softens them into one cohesive ramp at the
 * single canvas draw point (WheelComponent.drawWheel). Unknown values
 * (hex codes etc.) pass through untouched. Every value must keep white
 * 700-weight labels readable (mid-dark tones).
 */
export const SOFT_WHEEL_PALETTE: Record<string, string> = {
  // greens
  green:          '#2e7d32',
  darkgreen:      '#1b5e20',
  lime:           '#7cb342',
  teal:           '#148f77',
  // reds
  crimson:        '#c0392b',
  red:            '#d63031',
  darkred:        '#922b21',
  maroon:         '#7b241c',
  // oranges / yellows / golds
  orange:         '#f39c12',
  darkorange:     '#e67e22',
  gold:           '#d4a017',
  goldenrod:      '#c9a227',
  darkgoldenrod:  '#b8860b',
  yellow:         '#e1b12c',
  // blues / cyans
  blue:           '#2f6690',
  darkblue:       '#1f3a93',
  darkslateblue:  '#4a4e8f',
  cyan:           '#00a8b5',
  darkcyan:       '#16a085',
  // purples / pinks
  purple:         '#6c5ce7',
  indigo:         '#4834d4',
  darkviolet:     '#8e44ad',
  darkmagenta:    '#96248f',
  mediumvioletred:'#ad1457',
  deeppink:       '#d6336c',
  pink:           '#e84393',
  // browns
  brown:          '#8d6e63',
  saddlebrown:    '#7a5230',
  // neutrals
  black:          '#2d3436',
  darkslategray:  '#34495e',
  gray:           '#7f8c8d',
  darkgray:       '#95a5a6',
  silver:         '#aab7b8',
  white:          '#f1f2f6',
};

/** Draw-time lookup with passthrough for hex/unknown values. */
export function softenWheelColor(color: string): string {
  return SOFT_WHEEL_PALETTE[color] ?? color;
}
