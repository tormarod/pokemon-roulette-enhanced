# Secondary pages: adopt the game screen's design language

**Status:** approved, not started
**Scope:** Stats, Coffee, Settings, Credits pages + a shared nav component + a
global token hoist.
**Version:** ships as **4.1.0** (MINOR — four screens reworked plus a new shared
nav component).

---

## Current system (read this instead of re-researching)

### The design language the game screen already uses

Established in `trainer-team`, `items`, `wheel`, `run-status-header`,
`battle-prep-panel`, `main-adventure-roulette`. Every one of them:

1. Declares a **binary dark/light pair of classes** carrying CSS custom
   properties, toggled from `ThemeService.isDark$`. Component CSS **must never**
   use `body.theme-*` selectors — Angular's emulated encapsulation appends a
   scoping attribute to every compound selector segment including ancestors, so
   `body.theme-x .foo` in component CSS silently never matches. Custom
   properties, by contrast, inherit through the DOM and therefore pierce
   encapsulation.
2. Uses these six values (identical in all of them, only the prefix differs):

   | token | dark | light |
   |---|---|---|
   | `card-bg` | `#232629` | `#f5f6fa` |
   | `card-border` | `#333` | `#ccc` |
   | `card-shadow` | `0 0 0 1px rgba(255,255,255,.15), 0 12px 32px rgba(0,0,0,.5)` | `0 12px 32px rgba(0,0,0,.18)` |
   | `text` | `#dfe6e9` | `#2d3436` |
   | `tile-bg` | `rgba(255,255,255,.06)` | `rgba(0,0,0,.035)` |
   | `tile-border` | `rgba(255,255,255,.18)` | `rgba(51,51,51,.22)` |

3. Card geometry: `border-radius: 14px`, `border: 1px solid var(…card-border)`,
   `padding: 18px 20px`, `box-sizing: border-box`,
   `max-width: min(480px, 94vw)`, `margin: 16px auto`.
4. Inner tiles: `border-radius: 10px`–`12px`, `1px solid var(…tile-border)`,
   `background: var(…tile-bg)`.
5. Micro section labels: `font-size: 10px`, `text-transform: uppercase`,
   `letter-spacing: 0.05em`, `font-weight: 700`, `opacity: 0.55`.
6. Pills: `border-radius: 999px`.

### The five competing prefixes (why Phase 6 exists)

| prefix | component(s) | shared tokens | bespoke extras |
|---|---|---|---|
| `--panel-*` | `trainer-team/trainer-team.component.css`, `items/items.component.css` | all 6 | — |
| `--status-*` | `main-game/run-status-header/run-status-header.component.css` | all 6 | — |
| `--wheel-*` | `wheel/wheel.component.css` | all 6 | `positive`, `negative`, `chip-neutral-bg` |
| `--adv-*` | `main-game/roulette-container/roulettes/main-adventure-roulette/main-adventure-roulette.component.css` | all 6 | `row-bg`, `row-border`, `row-selected-bg` |
| `--bp-*` | `main-game/roulette-container/battle-prep-panel/battle-prep-panel.component.css` | all 6 | `sub-bg`, `sub-border`, `lead-bg`, `lead-border`, `divider`, `divider-strong`, `positive`, `negative`, `badge-neutral-bg`, `outline-border` |

Theme class blocks are named per component: `.panel-dark/.panel-light`,
`.status-card-dark/-light`, `.wheel-card-dark/-light`,
`.adventure-panel-dark/-light`, `.battle-prep-dark/-light`.

Out of scope for the migration (they use literal values, not a shared token
set, and are deliberately bespoke): `pokedex-detail-modal` (`.pd-light/.pd-dark`)
and `evolution-line-modal` (`.evo-light/.evo-dark`).

### The four pages today

All four sit **directly on the body background with no surface at all** — under
`theme-starters` their text lands straight on the tiled image. None consume the
panel tokens.

- **`stats/stats.component.html`** (379 lines; 43 lines CSS) — ten flat sections
  of `.row` / `.col-6 col-md-4` bare `Label: <strong>value</strong>` lines.
  Bootstrap `alert`, `badge text-bg-secondary`, `text-bg-success/danger`.
  `.type-bar-track` uses `var(--bs-secondary-bg)`, `.win-rate-trend-chart` uses
  `var(--bs-primary)` — Bootstrap tokens, not app tokens.
  Injects `ThemeService` only for `shareCardBackgroundImage`.
  `.share-card` and `.achievement-tile` are themed by **global `body.theme-*`
  rules in `styles.css:45-79`** — the other mechanism.
- **`settings/settings.component.html`** (167 lines; **0 lines CSS**) — one
  undifferentiated `max-width: 500px` stack of eleven
  `form-switch d-flex justify-content-between` rows.
- **`coffee/coffee.component.html`** (60 lines; **0 lines CSS**) — centered
  marketing copy, an `<h1>` cup glyph, `btn btn-danger` Ko-fi buttons, an
  unframed 225px QR image. Contains **hardcoded, non-i18n copy** (see Phase 4).
- **`credits/credits.component.html`** (58 lines; 5 lines CSS) — `text-align:
  justify` prose sections, one `.credits-disclaimer` box using grey rgba values
  that belong to no token set.

### Nav rails

Each page hand-rolls a `col-12 col-sm-2` button column with a **different**
destination set:

| page | buttons |
|---|---|
| settings | main game |
| stats | main game, coffee, credits + export / import / reset |
| coffee | main game, credits, stats |
| credits | main game, coffee, stats |

Nothing links **to** Settings from any of them. The button components are five
near-identical files (`main-game-button`, `settings-button`,
`main-game/stats-button`, `main-game/coffee-button`, `main-game/credits-button`),
each a `btn w-100` in a different Bootstrap color, each with a `Router` +
`navigate([...])`. `main-game/main-game.component.html` uses
`settings/coffee/stats + restart + language-selector` in a `col-sm-3` rail.

### Specs — safe to restructure

`stats.component.spec.ts` asserts only on `fixture.nativeElement.textContent`
containing translate **keys** (`stats.empty`, `stats.lifetime.runsPlayed`) plus
direct method calls. `settings.component.spec.ts`, `coffee.component.spec.ts`,
`credits.component.spec.ts` are component-API level only. **No spec couples to
DOM structure, ids, or Bootstrap classes.** Keep the translate keys rendered and
the specs pass unchanged.

---

## Phase 0 — Hoist the six shared tokens into `styles.css`

**File:** `src/styles.css`

Add, immediately after the `body.theme-plain-light` block (~line 34), before the
`.share-card` comment block:

```css
/* ── Shared panel/card design tokens ────────────────────────────────────────
   The single source of truth for the card language used by every panel in the
   app (wheel, trainer team, items, run status, battle prep, adventure, and the
   Stats/Settings/Coffee/Credits pages).

   These live here, on body.theme-*, rather than being redeclared per component:
   custom properties inherit through the DOM, so they pierce Angular's emulated
   view encapsulation and are readable from any component's scoped CSS. (A
   component's own CSS still must never write a body.theme-* SELECTOR — see the
   note further down this file for why that fails.)

   theme-starters shares theme-plain-dark's values throughout the app. */
body.theme-starters,
body.theme-plain-dark {
  --panel-card-bg: #232629;
  --panel-card-border: #333;
  --panel-card-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15), 0 12px 32px rgba(0, 0, 0, 0.5);
  --panel-text: #dfe6e9;
  --panel-tile-bg: rgba(255, 255, 255, 0.06);
  --panel-tile-border: rgba(255, 255, 255, 0.18);
}

body.theme-plain-light {
  --panel-card-bg: #f5f6fa;
  --panel-card-border: #ccc;
  --panel-card-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  --panel-text: #2d3436;
  --panel-tile-bg: rgba(0, 0, 0, 0.035);
  --panel-tile-border: rgba(51, 51, 51, 0.22);
}
```

Also add a shared page-shell block at the end of the file:

```css
/* ── Secondary page shell (Stats / Settings / Coffee / Credits) ──────────────
   These four routes render outside the game screen and share one layout:
   a centered column of panel cards under a page title. */
.page-shell {
  max-width: min(760px, 94vw);
  margin: 0 auto;
  padding: 16px 0 48px;
  color: var(--panel-text);
}

.page-title {
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  margin: 8px 0 4px;
}

.page-subtitle {
  text-align: center;
  font-size: 11px;
  opacity: 0.65;
  margin-bottom: 16px;
}

.page-card {
  background: var(--panel-card-bg);
  border: 1px solid var(--panel-card-border);
  border-radius: 14px;
  box-shadow: var(--panel-card-shadow);
  box-sizing: border-box;
  padding: 18px 20px;
  margin-bottom: 16px;
}

.page-card-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  opacity: 0.55;
  margin-bottom: 12px;
}

.page-tile {
  border: 1px solid var(--panel-tile-border);
  background: var(--panel-tile-bg);
  border-radius: 10px;
  box-sizing: border-box;
  padding: 10px 12px;
}
```

**Do NOT touch any existing component CSS in this phase.** Existing components
keep their local blocks; the values are identical, so nothing changes visually.

**Acceptance:** `npm run build` succeeds. `npm run test:local` passes. The game
screen is pixel-identical in all three themes (nothing consumes the new tokens
yet).

---

## Phase 1 — Shared `app-page-nav` component

**New files:** `src/app/page-nav/page-nav.component.{ts,html,css,spec.ts}`

A single nav rail used by all four pages. Destinations are always the same five,
with the current page's entry rendered as active (non-navigating).

`page-nav.component.ts`:

```ts
@Component({
  selector: 'app-page-nav',
  imports: [CommonModule, NgIconsModule, TranslatePipe],
  templateUrl: './page-nav.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './page-nav.component.css'
})
export class PageNavComponent {
  /** Which entry renders as the current page. */
  @Input() active: 'stats' | 'settings' | 'coffee' | 'credits' | null = null;

  readonly entries: ReadonlyArray<{ id: string; route: string; icon: string; labelKey: string }> = [
    { id: 'game',     route: '',         icon: 'bootstrapController',  labelKey: 'game.main.game.button.title' },
    { id: 'settings', route: 'settings', icon: 'bootstrapGear',        labelKey: 'settings.label' },
    { id: 'stats',    route: 'stats',    icon: 'bootstrapBarChartFill', labelKey: 'game.statsButton.label' },
    { id: 'coffee',   route: 'coffee',   icon: 'bootstrapCupHotFill',  labelKey: 'game.coffeeButton.label' },
    { id: 'credits',  route: 'credits',  icon: 'bootstrapPeopleFill',  labelKey: 'game.creditsButton.label' },
  ];

  constructor(private router: Router) {}

  go(route: string): void { this.router.navigate([route]); }
}
```

Register the five icons in the component's `NgIconsModule.withIcons({...})` the
same way `stats-button.component.ts` does (copy its import list).

`page-nav.component.html` — a horizontal, wrapping pill row (not a sidebar
column; the pages become a single centered column):

```html
<nav class="page-nav">
  @for (entry of entries; track entry.id) {
    <button type="button"
            class="page-nav-pill"
            [class.page-nav-pill-active]="entry.id === active"
            [disabled]="entry.id === active"
            (click)="go(entry.route)">
      <ng-icon [name]="entry.icon"></ng-icon>
      <span>{{ entry.labelKey | translate }}</span>
    </button>
  }
</nav>
```

`page-nav.component.css` — consumes the global tokens directly, **no local
dark/light classes needed** (that is the whole point of Phase 0):

```css
.page-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 12px 0 20px;
}

.page-nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--panel-tile-border);
  background: var(--panel-tile-bg);
  color: var(--panel-text);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.page-nav-pill:hover:not(:disabled) {
  border-color: var(--panel-text);
}

.page-nav-pill-active,
.page-nav-pill:disabled {
  opacity: 0.55;
  cursor: default;
}
```

**Leave the five existing button components in place** — `main-game.component.html`
still uses `settings-button`, `coffee-button`, `stats-button`, and
`restart-game-button`. Only the four secondary pages switch to `app-page-nav`.

`page-nav.component.spec.ts`: assert the component creates, that `entries` has
five items, and that `go('stats')` calls `router.navigate(['stats'])`.

**Acceptance:** component builds and its spec passes. Not yet wired into any
page.

---

## Phase 2 — Settings page

**Files:** `settings/settings.component.html` (rewrite),
`settings/settings.component.css` (new content),
`settings/settings.component.ts` (imports).

Replace the eleven-row flat stack with **four `.page-card` groups** in this
order and membership:

1. **Appearance** (`settings.group.appearance`) — theme selector, language
   selector.
2. **Gameplay** (`settings.group.gameplay`) — character gender, less
   explanations, hide shiny rolls, skip mega evolution animation, fast spin.
3. **Audio** (`settings.group.audio`) — mute audio, volume.
4. **Data** (`settings.group.data`) — What's New button, restart run button.

Structure per page:

```html
<div class="page-shell">
  <app-page-nav active="settings"></app-page-nav>
  <div class="page-title">
    <ng-icon name="bootstrapGear"></ng-icon> {{ 'settings.label' | translate }}
  </div>

  <div class="page-card">
    <div class="page-card-title">{{ 'settings.group.appearance' | translate }}</div>
    <div class="setting-row"> … </div>
  </div>
  …
</div>
```

Each individual setting is a `.setting-row`:

```css
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--panel-tile-border);
}

.setting-label {
  font-size: 12px;
  font-weight: 700;
}

.setting-hint {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 2px;
}

/* Radio group (character gender) stacks its options right-aligned. */
.setting-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

/* Restart is the destructive action — separated from the rest of the Data card. */
.setting-danger-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--panel-tile-border);
}

@media (max-width: 480px) {
  .setting-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
```

Rules for this rewrite:

- **Keep every existing binding verbatim** — `[checked]`, `(change)`,
  `(input)`, the `$safeNavigationMigration(...)` wrappers, every `id`/`for`
  pair, and the `settings$ | async` reads. Only the surrounding markup changes.
- Keep `<app-theme-selector>` and `<app-language-selector>` as-is; they already
  render a label + control pair. Drop the `form-switch` wrapper around the
  theme selector.
- **Volume is disabled while muted**: add
  `[disabled]="$safeNavigationMigration((settings$ | async)?.muteAudio)"` to the
  range input, and `[class.setting-row-disabled]="…muteAudio"` on its row with
  `.setting-row-disabled { opacity: 0.5; }`. This is a behavior change — it is
  intentional and belongs in the release notes.
- Keep `<app-restart-game-button (restartEvent)="onRestartGame()">` — it already
  opens its own confirm modal.
- The `openWhatsNew()` button keeps `whatsNew.settingsEntry` as its label; style
  it as a full-width pill using `.page-nav-pill` geometry (add a local
  `.setting-action-button` with the same border/background/radius tokens rather
  than reaching into the nav component's class).

`settings.component.ts`: add `PageNavComponent` to `imports`, remove
`MainGameButtonComponent`.

**New i18n keys** (`settings.group.appearance` / `.gameplay` / `.audio` /
`.data`) — Phase 7 adds them to all six locales.

**Acceptance:**
- `settings.component.spec.ts` passes unchanged.
- Every setting still round-trips: toggling each control calls the same
  `SettingsService` method as before and the control reflects the stored value
  after a reload.
- With Mute Audio on, the volume slider is visibly dimmed and non-interactive;
  turning mute off re-enables it.
- Readable in `theme-starters`, `theme-plain-dark`, **and `theme-plain-light`**.

---

## Phase 3 — Stats page

**Files:** `stats/stats.component.html` (rewrite),
`stats/stats.component.css` (extend), `stats/stats.component.ts` (imports).

Each of the existing sections becomes a `.page-card` with a `.page-card-title`,
in the same order as today: Lifetime, Records, Pokémon, Battles, Luck, History,
Per-generation, Achievements, Share.

**The `Label: <strong>value</strong>` lines become stat tiles.** Add to
`stats.component.css`:

```css
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.stat-tile {
  border: 1px solid var(--panel-tile-border);
  background: var(--panel-tile-bg);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-tile-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  opacity: 0.55;
}

.stat-tile-value {
  font-size: 16px;
  font-weight: 700;
}
```

Markup per stat:

```html
<div class="stat-tile">
  <span class="stat-tile-label">{{ 'stats.lifetime.runsPlayed' | translate }}</span>
  <span class="stat-tile-value">{{ summary.runsPlayed }}</span>
</div>
```

Apply this to every `.col-6 col-md-4` line in Lifetime, Records, Pokémon (the
four scalar entries), Battles (win rate by type), Luck, and the per-generation
block. The `[title]` tooltip on the Luck Index tile is preserved on the
`.stat-tile`.

Other conversions in this phase:

- **Section reset buttons** (Luck, History, Achievements) — move into a
  `.page-card-header` flex row alongside the title:
  ```css
  .page-card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
  .page-card-header .page-card-title { margin-bottom: 0; }
  ```
  Keep `btn btn-sm btn-outline-danger` — destructive actions stay Bootstrap-red
  and legible in all themes.
- **Import result alerts** — replace `alert alert-success` / `alert alert-danger`
  with a `.page-card` variant carrying a left accent bar:
  ```css
  .stats-notice { border-left: 3px solid #2ecc71; }
  .stats-notice-error { border-left-color: #e74c3c; }
  ```
- **Top-owned Pokémon** — each entry becomes a `.page-tile` with the sprite,
  name, and `x{{count}}`, laid out with `display: flex; flex-wrap: wrap; gap: 10px`.
- **Type bars** — retarget the Bootstrap tokens to app tokens:
  `.type-bar-track { background: var(--panel-tile-bg); border: 1px solid var(--panel-tile-border); }`
  and `.type-bar-fill { background: currentColor; opacity: 0.75; }`.
  `.win-rate-trend-chart { color: currentColor; }` instead of `var(--bs-primary)`.
- **Favorite-type badges** — replace `badge text-bg-secondary` with a
  `.page-tile` pill (`border-radius: 999px; padding: 4px 10px; font-size: 11px`).
- **Recent form / run history win-loss badges** — keep colored badges (they
  encode win/loss, so color is meaning, not decoration), but switch to explicit
  self-contained colors so they read on every surface:
  `.result-badge { border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: #fff; }`,
  `.result-badge-win { background: #2ecc71; color: #10331f; }`,
  `.result-badge-loss { background: #e74c3c; }`.
- **Run history rows** — `.run-history-list` keeps `max-height: 320px; overflow-y: auto`;
  each row becomes `.page-tile` with `margin-bottom: 6px` instead of
  `border-bottom`. Replace `text-muted` on the date with
  `.run-history-date { opacity: 0.6; font-size: 10px; }` (`text-muted` is a fixed
  grey that fails against the dark card).
- **Generation `<select>`** — keep `form-select form-select-sm w-auto`; add
  `background: var(--panel-tile-bg); color: var(--panel-text); border-color: var(--panel-tile-border);`
  via a `.stats-gen-select` class so it isn't a white box on the dark card.
- **Achievement tiles** — switch `.achievement-tile` to the shared tile tokens
  (`background: var(--panel-tile-bg); border: 1px solid var(--panel-tile-border); border-radius: 10px;`)
  and **delete the three `body.theme-* .achievement-tile` blocks from
  `styles.css` (lines 66-79)**.
- **`.share-card` stays exactly as it is** — including its three
  `body.theme-* .share-card` rules in `styles.css` (lines 45-64) and its
  `.share-card` block in `stats.component.css`. It is captured as a standalone
  PNG by `shareStatsCard()`, so its distinct per-theme fill/border is deliberate,
  not drift. Do not move it onto the panel tokens. Only reflow its inner
  `.col-6` lines into the `.stat-tile` markup **with an explicit
  `color: #fff`-inheriting wrapper** so the exported image stays white-on-dark
  regardless of page theme.

Left-rail buttons (export / import / reset-all) move into a `.page-card` at the
bottom of the page titled `stats.dataCard` (new key), laid out as a wrapping row.
The hidden `<input #importFileInput type="file" class="d-none">` moves with the
import button, unchanged.

`stats.component.ts`: add `PageNavComponent` to `imports`; remove
`MainGameButtonComponent`, `CoffeeButtonComponent`, `CreditsButtonComponent`.
**No TypeScript logic changes** — every method and `@ViewChild` stays as-is
(`shareCard` and `importFileInput` template refs must survive the rewrite).

**Acceptance:**
- `stats.component.spec.ts` passes unchanged (it asserts on rendered translate
  keys — keep `stats.empty` and `stats.lifetime.runsPlayed` rendered).
- With zero runs, only the empty-state message renders.
- Export downloads a JSON file; import of that file shows the success notice;
  each section reset opens its confirm modal and clears only that section.
- "Share" still produces a PNG whose text is white-on-dark in **all three**
  themes.
- Readable in all three themes, `plain-light` included.

---

## Phase 4 — Coffee page (reskin + i18n fixes)

**Files:** `coffee/coffee.component.html` (rewrite),
`coffee/coffee.component.css` (new content), `coffee/coffee.component.ts`
(imports only).

**Keep the existing structure and both donation paths** — the PIX/Ko-fi block is
the fork's attribution to the upstream author. Only the surfaces change:

1. `.page-shell` + `<app-page-nav active="coffee">` + `.page-title`
   (`coffee.title`).
2. Intro card: `coffee.how_to_help`, `coffee.donations`.
3. "Support this fork" card: `coffee.supportFork`,
   `coffee.supportForkDescription`, Ko-fi button → `https://ko-fi.com/tormarod`.
4. "Support the original creator" card: `coffee.support`, containing two
   `.page-tile` columns side by side at `sm+`, stacked below:
   - PIX tile: `coffee.pixIntro`, the QR image framed
     (`border-radius: 10px; border: 1px solid var(--panel-tile-border); background: #fff; padding: 8px;`
     — the QR needs a white quiet zone to stay scannable on the dark card),
     and the copy link.
   - Ko-fi tile: `coffee.internationalIntro`, `coffee.tryKofi`, Ko-fi button →
     `https://ko-fi.com/zeroxm`.
5. Thanks card: `coffee.thanks`, `coffee.hope`.
6. Footnote: `coffee.supportNote` as `.page-subtitle` (not `text-muted`, which
   is a fixed grey that fails on the dark card).

Both Ko-fi buttons keep `btn btn-danger` — brand-ish call-to-action, legible on
every surface.

**Replace the hardcoded strings with new i18n keys** (currently untranslatable):

| current literal | new key | en value |
|---|---|---|
| `🇧🇷 É do Brasil? 🇧🇷 Manda um PIX! 🇧🇷` | `coffee.pixIntro` | `🇧🇷 From Brazil? Send a PIX! 🇧🇷` |
| `Clique para copiar!` | `coffee.pixCopy` | `Click to copy!` |
| `PIX copiado!` | `coffee.pixCopied` | `PIX copied!` |
| `🌐 Want an international option? 🌐` | `coffee.internationalIntro` | `🌐 Want an international option? 🌐` |
| `Try Ko-fi:` | `coffee.tryKofi` | `Try Ko-fi:` |
| `Buy me a Coffee` (2nd button) | reuse existing `coffee.buyMeACoffee` | — |

Keep the Portuguese wording in `pt.json` for `coffee.pixIntro` / `pixCopy` /
`pixCopied` (that is what the literals said).

`coffee.component.ts`: add `PageNavComponent` to `imports`; remove
`MainGameButtonComponent`, `CreditsButtonComponent`, `StatsButtonComponent`.
`copyPixCode()` and the PIX payload string are unchanged.

**Acceptance:** the QR is scannable in all three themes (white frame present);
clicking it or the link copies the PIX code and flips the label to
`coffee.pixCopied`; both Ko-fi links open the correct profiles
(`tormarod` for the fork, `zeroxm` for the original).

---

## Phase 5 — Credits page

**Files:** `credits/credits.component.html` (rewrite),
`credits/credits.component.css` (replace), `credits/credits.component.ts`
(imports).

Straight reskin, no content changes: `.page-shell` +
`<app-page-nav active="credits">` + `.page-title` (`credits.title`), then one
`.page-card` per existing section — Enhanced Fork, Created By, Special Thanks,
Thank You — and the disclaimer as a final `.page-card` variant:

```css
.credits-disclaimer {
  border-left: 3px solid var(--panel-tile-border);
}

.credits-text {
  text-align: justify;
  font-size: 12px;
  line-height: 1.5;
}

.credits-links { list-style: none; padding: 0; margin: 0; }
.credits-links li { padding: 4px 0; font-size: 12px; }
```

Delete the old `.credits-disclaimer` grey-rgba rules. Links keep default anchor
styling — verify contrast on the dark card; if the default blue is too dark on
`#232629`, set `.page-card a { color: #74b9ff; }` scoped under a
`body.theme-plain-dark`/`theme-starters` rule **in `styles.css`, not component
CSS**.

`credits.component.ts`: add `PageNavComponent`; remove the three button imports.

**Acceptance:** all links still resolve; readable in all three themes.

---

## Phase 6 — Migrate the five prefixes onto the global tokens

Run this **after** Phases 0-5 are reviewed and shipped, so a regression on the
wheel is never tangled up with the redesign diff. Purely mechanical, **zero
intended visual change**, one component at a time.

For each of the five components in the prefix table:

1. Delete the six shared tokens from **both** its `-dark` and `-light` blocks.
2. Find/replace its usages within that one file:
   `var(--wheel-card-bg)` → `var(--panel-card-bg)`, and the same for
   `card-border`, `card-shadow`, `text`, `tile-bg`, `tile-border`.
   (`--status-*` and `--panel-*` map by identical suffix; `--bp-*` maps
   `--bp-card-bg` → `--panel-card-bg` etc., and its `--bp-sub-bg` / `--bp-lead-bg`
   are **bespoke — leave them alone**.)
3. If a component's dark/light blocks are now **empty**, delete the blocks and
   remove the `[class.x-dark]`/`[class.x-light]` bindings from its template and
   the `isDark$` subscription from its TS **only if nothing else uses them**.
   This applies to `trainer-team`, `items`, and `run-status-header` (all six
   tokens, no extras). `wheel`, `main-adventure-roulette`, and
   `battle-prep-panel` keep their blocks for the bespoke extras.
4. Update each file's leading comment: the tokens now come from `styles.css`.

Order (least to most risky): `items` → `trainer-team` → `run-status-header` →
`main-adventure-roulette` → `wheel` → `battle-prep-panel`.

**Caution on step 3:** `trainer-team`'s comment notes that its `--panel-*` vars
inherit down into `app-badges`, `app-storage-pc`, `app-pokedex`, `app-market`.
Those children keep working after the hoist (they read the same names, now from
`body`), but **check each child renders correctly before deleting the parent's
block**. Also note `styles.css` already sets `.pc-modal .pc-tile` /
`.market-modal .modal-content` colors with literal values for CDK drag previews
and Bootstrap modal content rendered outside the component tree — leave those
literal rules alone; they intentionally do not depend on inherited vars.

**Acceptance per component:** screenshot-compare that screen in all three themes
before/after — no visible difference. `npm run test:local` passes after each.

---

## Phase 7 — i18n, version, docs

1. **New keys** — add to `src/assets/i18n/en.json` (real English) and all five
   others (`de`, `es`, `fr`, `it`, `pt` — English placeholder if untranslated,
   except the three `coffee.pix*` keys which keep their Portuguese wording in
   `pt.json`):
   - `settings.group.appearance`, `settings.group.gameplay`,
     `settings.group.audio`, `settings.group.data`
   - `stats.dataCard`
   - `coffee.pixIntro`, `coffee.pixCopy`, `coffee.pixCopied`,
     `coffee.internationalIntro`, `coffee.tryKofi`
2. **Version** — `package.json` `version` → `4.1.0`.
3. **Release notes** — newest-first entry in `src/app/data/release-notes.ts`
   with `whatsNew.v4_1_0.*` note keys covering: redesigned Stats/Settings/Coffee/
   Credits pages, new shared page navigation, volume slider now disabled while
   muted. Add those keys **plus a `v4_1_0` version label** to all six locale
   files.
4. **README** — add the redesign to the "New features added on top of the
   original" list.
5. **Backlog** — no existing entry covers this, so nothing to delete. Add one
   new entry if Phase 6 is deferred: "Five `--*-card-*` prefixes still duplicate
   the six shared panel tokens; migrate onto the global `--panel-*` set."
6. Move this file to `docs/plans/done/` once every phase is checked off.

---

## Phase checklist

- [x] Phase 0 — global tokens + page shell in `styles.css`
- [x] Phase 1 — `app-page-nav`
- [x] Phase 2 — Settings
- [x] Phase 3 — Stats
- [x] Phase 4 — Coffee
- [x] Phase 5 — Credits
- [x] Phase 6 — token migration of the five prefixes
- [ ] Phase 7 — i18n, version 4.1.0, release notes, README, backlog

## Global acceptance

- `npm run build` clean, `npm run test:local` green, no spec edited to make it
  pass.
- Every one of the four pages verified in **`theme-starters`, `theme-plain-dark`,
  and `theme-plain-light`** — no dark-on-dark or light-on-light text, no
  unthemed white Bootstrap boxes, no fixed-grey `text-muted` on a dark card.
- No component CSS anywhere contains a `body.theme-*` selector.
- The game screen itself is unchanged through Phase 5.
