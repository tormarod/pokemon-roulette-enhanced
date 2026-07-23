# Wheel Restyle — "2a Universal Wheel" (supersedes 1a/1d)

> **Status** (update as phases ship; pause for review after each phase; move to `docs/plans/done/` when all done):
> - [x] Phase 1 — Palette map + canvas chrome
> - [x] Phase 1b — 2a design-update amendments to canvas chrome
> - [x] Phase 2 — Card wrapper, pill button, result chip (variants), theme vars
> - [x] Phase 3 — Battle header projection, strip restyle (tile sub-panel), release notes
>
> All phases shipped 2026-07-23 (v3.15.1). Post-review tweaks folded in: card top margin, strip `:host` width fix, wheel scale 0.42/0.62, opponent label stacked above its type icons.

## Design update (2026-07-23): "2a Universal Wheel" handoff supersedes 1a/1d

The chosen direction is now **2a** — one universal draw routine for every wheel config. Deltas vs. the 1a/1d spec below (where they conflict, **2a wins**):

- **Reference scale is 260px canvas / radius 112 / segRadius 102** → scale factor `s = radius / 112`, `segRadius = 102 * s`.
- **Segment labels get a thin black outline**: `strokeText()` with `lineWidth = max(1, fontSize * 0.09)`, `strokeStyle #000`, `lineJoin: 'round'`, drawn before the white `fillText()`; text at `segRadius - 6*s`, baseline offset `fontSize * 0.32`.
- **Type-bias highlight stays gold `#FFD700` 3px** (Phase 1's white choice reverted — 2a reserves gold outline for type bias).
- **Hub: flush ring, no gap** — white disc first at `hubR = 28*s` (shadow 6*s, 1.5*s #333 border), gold accent ring `4*s` stroke centered at `hubR + 2*s` (inner edge lands on disc edge; gold glow shadow 10*s), pokeball glyph `15*s` radius, center button `4.5*s`.
- **Card**: `padding: 22px`, `gap: 8px`; **result chip slot is 28px**; chip animation `result-pop 0.5s ease-out both`.
- **Result chip has variants**:
  - Battle wheels → VICTORY chip (`linear-gradient(135deg,#eafaf1,#c8f0d8)` / `#1b7a2f`) or DEFEAT chip (`linear-gradient(135deg,#fdecea,#f8c9c4)` / `#a3281f`). Driven by new optional `WheelItem.resultKind?: 'victory' | 'defeat'`, set only in `buildVictoryOdds` (yes → victory, no → defeat). New i18n keys `wheel.victory` / `wheel.defeat` in all six locales (properly translated — trivial words).
  - All other wheels → neutral chip: bg `rgba(255,255,255,0.08)` dark / `rgba(0,0,0,0.05)` light, text in card fg, winning item's translated text uppercased.
- **Matchup strip (Phase 3) restyled as the battle-prep-style tile sub-panel**: `border-radius:10px; padding:12px`, bg/border `rgba(0,0,0,0.035)`/`rgba(51,51,51,0.22)` light and `rgba(255,255,255,0.06)`/`rgba(255,255,255,0.18)` dark (as `--wheel-tile-bg`/`--wheel-tile-border` card vars); centered Opponent row (10px/0.55-opacity uppercase label + 20px icons); 1px tile-border dividers; Super Effective + Resists blocks (10px/700 uppercase green labels), "Advantage +N" readout (13px/800 green); divider; Vulnerable block (red label + icons + "Weak −N" 13px/800 red readout). Existing i18n matchup keys reused. **Deviations kept deliberately:** (1) the win-chance + odds-breakdown section stays at the top of the strip (info the mock omitted but the game needs); (2) accent colors use the theme vars (`--wheel-positive`/`--wheel-negative`, brightened in dark) instead of the spec's constant `#2e7d32`/`#c0392b`, per the repo's every-theme-contrast rule.
- `.spin-button` exists only in wheel.component.{html,css} — no global class to retire. `.roulette-header` stays global for the ~25 non-battle screens.

## Context

The canvas roulette wheel still uses the original raw look: CSS named colors (`green`/`crimson`), a heavy bronze/gold radial-gradient ring, a full-size two-tone pokeball hub, Arial labels, and a Bootstrap `btn-dark`/`btn-light` spin button. A design pass ("1a Refined Classic", reference: `Roulette Wheel Redesign.dc.html`) modernizes it to match the evolution-popover / battle-prep-card language: soft card surface, slim gold ring, flat pokeball hub badge, pill spin button, animated result chip.

**User decisions (locked):**
1. **Battle wheels keep the real interleaved many-slice ticket pattern** (the "1d" variant) — `buildVictoryOdds`/`interleaveOdds` untouched; only colors change at draw time.
2. **Card wrapper lives inside `WheelComponent`** → every wheel screen gets it. Battle screens project title + retry note + matchup strip INTO the card via `<ng-content select="[wheel-card-header]">`; other screens keep their headers above the card unchanged.
3. **Theme: binary dark/light** matching the battle-prep-panel precedent (`ThemeService.isDark$` → theme class → CSS custom properties). Dark card `#232629`, light `#f5f6fa`. No `body.theme-*` selectors in component CSS (they silently fail under emulated encapsulation).
4. **Global palette harmonization**: named-color → hex map applied at the single draw point, passthrough for unknown/hex values. Covers all wheels (adventure, cave, catch, national-dex) without touching producers.

Version: `3.15.0` → **`3.15.1`** (PATCH — visual polish, no mechanic change).

## Verified current-system facts

- `src/app/wheel/wheel.component.ts`: two canvases — `#wheel` (segments/ring/hub) + `#pointer` (40px wide, to the RIGHT of the wheel; tip points LEFT at vertical center; `.canvas-container { margin-left: 40px }` re-centers). Draw methods: `drawWheel` (L157, `segRadius = radius * 0.90`, `fillStyle = item.fillStyle` at L180, `item.highlighted` → 3px `#FFD700` stroke, labels `fontSize + 'px Arial'` white right-aligned at `segRadius - 7`), `drawBorderRing` (L211, bronze radial gradient), `drawPokeball` (L237, `pbRadius = radius*0.15` mobile / `*0.10` desktop), `drawPointer` (L280, 10-vertex notched polygon, `#FFD700`). Dark mode field is named `darkMode` (`Observable<boolean>` = `themeService.isDark$`). Template has `<p aria-live="polite">{{ currentSegment | translate }}</p>` ABOVE the canvas (live-ticks during spin) and a Bootstrap `btn-light`/`btn-dark` spin button. Fields `pointerStrokeColor`/`pointerFillColor` (L48–49) are dead — delete them.
- Wheel size responsive: `viewportMin * 0.5` desktop / `0.7` mobile (breakpoint 768). `fontSize = wheelWidth/24`, capped 14 (≥16 items) / 10 (≥32).
- Spin mechanics (`spinWheel`, `animate`, `PendingSpinService` commit-on-click, fastSpin, spacebar handler, `preprocessTranslations`) — **DO NOT TOUCH**.
- All ~28 `<app-wheel>` usages project no content today → adding `<ng-content>` is safe.
- 4 battle templates (`src/app/main-game/roulette-container/roulettes/{gym,rival,elite-four,champion}-battle-roulette/*.component.html`) share one shape: `@if (!prepPhase) { <div class="roulette-header"> h1.title + p.respin-reason + <app-matchup-strip …> </div> }` then `@if (prepPhase) { <app-battle-prep-panel …> } @else { <app-wheel …> }` then `<div class="roulette-action-row"></div>`.
- `app-matchup-strip` (`src/app/main-game/matchup-strip/`) is used ONLY in those 4 templates (battle-prep-panel inlines its own copy). Its CSS hardcodes exactly four color declarations: `.matchup-label-positive`/`.matchup-delta-positive` `#2e7d32`, `.matchup-label-negative`/`.matchup-delta-negative` `#c62828`.
- `.roulette-header` (min-height 140px) and `.roulette-action-row` (56px) are global spacers in `src/styles.css` — keep them for non-battle screens; battle screens drop `.roulette-header`.
- Battle yes/no fillStyles: `'green'`/`'crimson'` from `base-battle-roulette.component.ts` (~L203/225).
- Full named-color set used as `fillStyle` by producers (grep-verified): green, blue, crimson, darkred, black, red, purple, gray, goldenrod, brown, yellow, darkorange, darkblue, pink, deeppink, darkgreen, white, darkcyan, darkgoldenrod, darkviolet, cyan, saddlebrown, orange, gold, darkslategray, teal, indigo, darkslateblue, darkgray, silver, mediumvioletred, maroon, lime, darkmagenta. Hex producers (ability-capsule TYPE_COLOR map etc.) pass through.
- `main-adventure-roulette.component.html` L10 uses `candidate.fillStyle` as a DOM border-color — intentionally NOT harmonized (canvas-only map).
- Specs: `wheel.component.spec.ts` (11 tests) is logic-only, no canvas/DOM color asserts. Battle roulette specs only query `.battle-prep-*` (rendered when `prepPhase === true`, their default). `matchup-strip.component.spec.ts` queries `.odds-winchance`/`.matchup-delta` — classes kept. No spec queries the removed `<p>` or `.roulette-header`.
- Release-notes machinery: `src/app/data/release-notes.ts` (newest-first), locale files have top-level `"v3_15_0": "Version 3.15.0"` labels and `"whatsNew": { "v3_15_0": … }` blocks. en.json real, other 5 English placeholders OK.

---

## Phase 1 — Palette map + canvas chrome

### 1.1 NEW `src/app/utils/wheel-palette.ts`

```ts
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
```

### 1.2 NEW `src/app/utils/wheel-palette.spec.ts`

Three tests: (1) maps named producer colors (`green`→`#2e7d32`, `crimson`→`#c0392b`, `darkorange`→`#e67e22`); (2) passthrough for hex (`'#FFD700'`, `'#A8A77A'`), unknown strings, and `''`; (3) loop over the full 34-name producer-color list above asserting `SOFT_WHEEL_PALETTE[color]` matches `/^#[0-9a-f]{6}$/` (use `.withContext(color)`).

### 1.3 EDIT `src/app/wheel/wheel.component.ts` — chrome

Add import: `import { softenWheelColor } from '../utils/wheel-palette';`
Delete dead fields `pointerStrokeColor`/`pointerFillColor` (L48–49).

**`drawWheel(rotation = 0)`** — keep the loop/rotation math identical; change only:
- `const s = radius / 94;` (scale factor vs. 220px prototype) and `const segRadius = radius * 0.915;` (was 0.90).
- Remove the `drawBorderRing` call from BEFORE the loop; call it AFTER the loop (ring on top of slice edges), then `this.drawHub(centerX, centerY, radius);` (replaces the `pbRadius` mobile/desktop split + `drawPokeball` call).
- Segment fill: `this.wheelCtx.fillStyle = softenWheelColor(item.fillStyle);`
- After each fill, add a subtle divider: `lineWidth = Math.max(1, s); strokeStyle = 'rgba(255, 255, 255, 0.3)'; stroke();`
- `item.highlighted` outline: change `#FFD700` → `#FFFFFF` (gold would vanish against the new gold ring; update the comment to say so). Keep 3px.
- Label font: `'700 ' + this.fontSize + 'px system-ui, sans-serif'` (was Arial). Keep white, right-aligned, `segRadius - 7`, `< 160` guard.

**`drawBorderRing(cx, cy, radius)`** — replace body entirely:
```ts
const ctx = this.wheelCtx;
const s = radius / 94;
// Single flat gold ring
ctx.beginPath();
ctx.arc(cx, cy, radius - 3 * s, 0, Math.PI * 2);
ctx.lineWidth = 5 * s;
ctx.strokeStyle = '#f9ca24';
ctx.stroke();
// Hairline outer edge
ctx.beginPath();
ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
ctx.lineWidth = 1;
ctx.strokeStyle = 'rgba(51, 51, 51, 0.5)';
ctx.stroke();
```

**Delete `drawPokeball`; add `drawHub(cx, cy, radius)`** (fixed ratios of the 94px prototype radius — mobile and desktop get proportionally identical hubs):
```ts
private drawHub(cx: number, cy: number, radius: number): void {
    const ctx = this.wheelCtx;
    const s = radius / 94;
    // Glow ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 30 * s, 0, Math.PI * 2);
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = '#f9ca24';
    ctx.shadowColor = 'rgba(249, 202, 36, 0.55)';
    ctx.shadowBlur = 10 * s;
    ctx.stroke();
    ctx.restore();
    // White backing disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 24 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6 * s;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, 24 * s, 0, Math.PI * 2);
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = '#333333';
    ctx.stroke();
    // Flat pokeball glyph
    const r = 13 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI, true);   // top half, red
    ctx.closePath();
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI, false);  // bottom half, white
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#000000';               // belt band
    ctx.fillRect(cx - r, cy - 1.5 * s, r * 2, 3 * s);
    ctx.beginPath();                          // glyph outline
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = '#333333';
    ctx.stroke();
    ctx.beginPath();                          // center button
    ctx.arc(cx, cy, 4 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(1, s);
    ctx.strokeStyle = '#333333';
    ctx.stroke();
}
```

**`drawPointer()`** — replace the notched polygon with a simple triangle (tip pointing LEFT into the wheel, same canvas):
```ts
drawPointer(): void {
    const ctx = this.pointerCtx;
    ctx.clearRect(0, 0, this.pointerCanvas.width, this.pointerCanvas.height);
    ctx.save();
    const pw = this.pointerCanvas.width;   // cursorWidth = 40
    const midY = this.pointerCanvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(2, midY);                   // tip, pointing left into the wheel
    ctx.lineTo(pw * 0.75, midY - 13);
    ctx.lineTo(pw * 0.75, midY + 13);
    ctx.closePath();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#f9ca24';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}
```

**Phase 1 acceptance:** `npm run test:local` green (existing 11 wheel tests + new palette spec). Visual (`npm start`): flat gold ring, white slice dividers, bold system-ui labels, glowing flat-pokeball hub, gold triangle pointer; battle slices `#2e7d32`/`#c0392b`; honey-boosted slices outlined white.

**⏸ Pause for review.**

---

## Phase 2 — Card wrapper, pill button, result chip, theme vars

### 2.1 EDIT `wheel.component.ts` — result-chip state

- New field near `currentSegment`: `resolvedIndex: number | null = null;` (doc: index of resolved winning item; null while unspun/spinning — drives the result chip).
- New getter:
```ts
/** Chip text color = the winning slice's harmonized fill (on a white chip). */
get chipColor(): string {
    return this.resolvedIndex !== null && this.items[this.resolvedIndex]
      ? softenWheelColor(this.items[this.resolvedIndex].fillStyle)
      : 'inherit';
}
```
- Wire in exactly four places:
  1. `spinWheel()` right after `this.spinning = true;` → `this.resolvedIndex = null;`
  2. `animate()` completion branch (next to `this.spinning = false;`) → `this.resolvedIndex = this.winningNumber;`
  3. `resolvePendingSpinIfAny()` after `this.winningNumber = resolvedIndex;` → `this.resolvedIndex = resolvedIndex;`
  4. `ngOnChanges` inside the `items && !firstChange` block, first lines: `this.resolvedIndex = null; this.currentSegment = '-';` (chip clears when a retry loss rebuilds the odds).

### 2.2 REPLACE `wheel.component.html`

```html
<div class="wheel-card" [ngClass]="(darkMode | async) ? 'wheel-card-dark' : 'wheel-card-light'">
    <ng-content select="[wheel-card-header]"></ng-content>
    <div class="canvas-container">
        <canvas id="wheel" #wheel [width]="wheelWidth" [height]="canvasHeight"
                [attr.aria-label]="'wheel.spin' | translate" (click)="spinWheel()"></canvas>
        <canvas id="pointer" #pointer [width]="cursorWidth" [height]="canvasHeight"></canvas>
    </div>
    <button class="spin-button" (click)="spinWheel()">
        {{ 'wheel.spin' | translate }}
    </button>
    <div class="result-slot" aria-live="polite">
        @if (resolvedIndex !== null && items[resolvedIndex]) {
            <span class="result-chip" [style.color]="chipColor">{{ items[resolvedIndex].text | translate }}</span>
        } @else if (spinning) {
            <span class="result-live">{{ currentSegment | translate }}</span>
        }
    </div>
</div>
```
Notes: old `aria-live` `<p>` above the wheel replaced by the `aria-live` slot below the button (live segment text during spin, styled chip after resolution — chip text is the translated winning key, so **no new i18n strings**). Bootstrap `btn` classes dropped. Canvas click-to-spin kept.

### 2.3 REPLACE `wheel.component.css`

```css
/* Binary dark/light card, matching the battle-prep-panel precedent
   (CSS custom properties on theme classes; NEVER body.theme-* here —
   emulated encapsulation makes those silently fail in component CSS). */

.wheel-card-dark {
    --wheel-card-bg: #232629;
    --wheel-card-border: #333;
    --wheel-card-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15), 0 12px 32px rgba(0, 0, 0, 0.5);
    --wheel-text: #dfe6e9;
    /* Inherit down into projected content (matchup strip) — custom properties
       pierce Angular's emulated encapsulation because they inherit via the DOM. */
    --wheel-positive: #6fcf6f;
    --wheel-negative: #ff8a80;
}

.wheel-card-light {
    --wheel-card-bg: #f5f6fa;
    --wheel-card-border: #ccc;
    --wheel-card-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
    --wheel-text: #2d3436;
    --wheel-positive: #2e7d32;
    --wheel-negative: #c62828;
}

.wheel-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: fit-content;
    max-width: 94vw;
    box-sizing: border-box;
    margin: 0 auto 16px;
    padding: 18px 24px;
    background: var(--wheel-card-bg);
    color: var(--wheel-text);
    border: 1px solid var(--wheel-card-border);
    border-radius: 14px;
    box-shadow: var(--wheel-card-shadow);
}

/* Pointer canvas sits to the right; this offset re-centers the wheel visually. */
.canvas-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-left: 40px;
}

.spin-button {
    min-width: 200px;
    border: 1px solid var(--wheel-text);
    border-radius: 999px;
    padding: 10px 32px;
    background: none;
    color: var(--wheel-text);
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.03em;
    cursor: pointer;
}

.spin-button:hover {
    background: var(--wheel-text);
    color: var(--wheel-card-bg);
}

/* Fixed-height slot so the card never resizes when the chip appears. */
.result-slot {
    height: 34px;
    max-width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.result-live {
    font-weight: 700;
    font-size: 14px;
    color: var(--wheel-text);
    white-space: nowrap;
}

.result-chip {
    display: inline-flex;
    align-items: center;
    background: #fff;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 6px 16px;
    font-weight: 700;
    font-size: 13px;
    white-space: nowrap;
    animation: result-pop 0.25s ease-out;
}

@keyframes result-pop {
    0%   { opacity: 0; transform: scale(0.9) translateY(4px); }
    60%  { opacity: 1; transform: scale(1.05) translateY(-1px); }
    100% { transform: scale(1); }
}
```
Chip coloring is generic (works for every wheel): white chip, `#333` border, text in the winning slice's harmonized color — even `black` maps to `#2d3436`, readable on white.

**Do NOT touch `src/styles.css` in this phase** — `.roulette-header`/`.roulette-action-row` spacers stay for all screens (battle screens change in Phase 3).

**Phase 2 acceptance:** every wheel screen shows the card; `plain-light` → light card, `starters`/`plain-dark` → dark card; spin → live text ticks in the slot, then chip pops with winning text; card height stable; pill hover inverts; `npm run test:local` green.

**⏸ Pause for review.**

---

## Phase 3 — Battle header projection, strip theming, release notes

### 3.1 EDIT the 4 battle templates

Files (identical transformation; gym shown):
- `src/app/main-game/roulette-container/roulettes/gym-battle-roulette/gym-battle-roulette.component.html`
- `.../rival-battle-roulette/rival-battle-roulette.component.html`
- `.../elite-four-battle-roulette/elite-four-battle-roulette.component.html`
- `.../champion-battle-roulette/champion-battle-roulette.component.html`

Delete the leading `@if (!prepPhase) { <div class="roulette-header"> … </div> }` block entirely and move its inner content inside `<app-wheel>` in the `@else` branch:

```html
} @else {
    <app-wheel #wheel [items]="victoryOdds" (selectedItemEvent)="onItemSelected($event)">
        <div wheel-card-header class="wheel-card-header">
            <h1 class="title">{{currentLeader.name | translate}} {{ 'game.main.roulette.gym.defeated' | translate }}</h1>
            <p class="respin-reason">
                {{ (retries > 0 && currentItem) ? (currentItem.text | translate) + " x" + retries : ""}}
            </p>
            @if (currentLeader?.types?.length) {
                <app-matchup-strip
                    [opponentTypes]="effectiveOpponentTypes ?? []"
                    [superEffectiveTypes]="matchupSuperEffectiveTypes"
                    [resistTypes]="matchupResistTypes"
                    [weakTypes]="matchupDisadvantageTypes"
                    [advantageDelta]="matchupAdvantageDelta"
                    [disadvantageDelta]="matchupDisadvantageDelta"
                    [odds]="currentOdds" />
            }
        </div>
    </app-wheel>
}
```
Per-file: keep each file's own existing h1 content and guard (rival: `currentRival?.types?.length`; elite: `currentElite?.…`; champion: `currentChampion?.…`) — move verbatim, don't rewrite. Prep-panel bindings, modals, `.roulette-action-row` unchanged. Battle screens drop `.roulette-header` entirely (no empty spacer left); the projected header inside the card occupies roughly the same ~140px. Non-battle screens keep `.roulette-header` — global rule in `styles.css` stays.

### 3.2 EDIT the 4 battle `*.component.css` files

Add to each (keep their existing `.title`/`.respin-reason` rules):
```css
/* Header block projected into the wheel card (wheel-card-header slot). */
.wheel-card-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
}

.wheel-card-header .title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
}

.wheel-card-header .respin-reason {
    margin: 0;
    min-height: 1em;
}
```
(20px title matches `battle-prep-title` so prep → wheel feels like the same card. Text color inherits from the card's `var(--wheel-text)` — no rule needed.)

### 3.3 EDIT `src/app/main-game/matchup-strip/matchup-strip.component.css`

Replace exactly the four hardcoded color declarations:
```css
.matchup-label-positive { color: var(--wheel-positive, #2e7d32); }
.matchup-label-negative { color: var(--wheel-negative, #c62828); }
.matchup-delta-positive { color: var(--wheel-positive, #2e7d32); }
.matchup-delta-negative { color: var(--wheel-negative, #c62828); }
```
Why this works: custom properties inherit through the DOM regardless of emulated encapsulation (encapsulation scopes selectors, not inheritance); the strip is used only inside the 4 battle templates, now projected into the card that defines the vars. Fallbacks preserve today's colors for any future standalone use. The strip's `.odds-winchance` headline satisfies the handoff's win-chance readout — no new element.

### 3.4 Version / release notes / README

1. `package.json`: `"version": "3.15.1"`.
2. `src/app/data/release-notes.ts`: prepend `{ version: '3.15.1', date: '2026-07-23', noteKeys: ['whatsNew.v3_15_1.0'] }` (match the exact shape of the existing top entry).
3. All six `src/assets/i18n/{en,de,es,fr,it,pt}.json`: add top-level `"v3_15_1": "Version 3.15.1",` next to `"v3_15_0"`, and inside `"whatsNew"` (before `"v3_15_0"`):
```json
"v3_15_1": {
  "0": "🎡 The roulette wheel got a visual refresh: a themed card around every wheel, a cleaner gold-ring look, a harmonized slice palette, and a result chip that pops in with your spin's outcome. Battle wheels now show the matchup and win chance right on the card."
},
```
(en real; other 5 carry the English text as placeholder.)
4. `README.md`: add one bullet to "New features added on top of the original:": `- A restyled roulette wheel: themed card chrome around every wheel (dark/light aware), a harmonized slice palette, and an animated result chip; battle wheels show the matchup strip and win chance on the card itself.`

**⏸ Phase 3 done → move plan to `docs/plans/done/`.**

---

## Verification

`npm run test:local` after every phase — expected green throughout (verified assumptions: wheel spec is logic-only; battle specs render prep phase; matchup-strip spec's queried classes kept; new `wheel-palette.spec.ts` added in Phase 1).

Manual acceptance (input → expected):
1. Theme `plain-light`, gym battle after prep confirm → light card `#f5f6fa`; title + respin note + matchup strip INSIDE the card above the canvas; strip positive/negative in `#2e7d32`/`#c62828`; "Win chance: NN%" readable.
2. Same screen, switch to `starters` or `plain-dark` → dark card `#232629`, strip colors flip to `#6fcf6f`/`#ff8a80`, no dark-on-dark anywhere.
3. Spin battle wheel → interleaved thin yes/no slices `#2e7d32`/`#c0392b` with 1px white dividers; live text ticks in the 34px slot; on stop, chip pops (`result-pop`) with the outcome text colored by the winning slice; card height unchanged.
4. Lose with retries remaining → items rebuild → chip clears.
5. Starter/generation/adventure wheels → same card + pill; their headers remain ABOVE the card in the unchanged `.roulette-header`; pill hover inverts colors.
6. Honey type-bias active on a catch wheel → boosted slices outlined 3px white, visible against the gold ring.
7. Reload mid-spin → resolves instantly to committed outcome AND chip shows it.
8. Spacebar spins (no modal/input focused); canvas click spins; Fast Spin still 400ms.
9. Mobile width (<768px) → wheel 0.7×viewportMin, hub/ring/pointer proportions identical (fixed ratios), card fits 94vw.
