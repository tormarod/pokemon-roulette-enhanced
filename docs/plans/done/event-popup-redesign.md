# Event Popup Redesign

> **Status** (update as phases ship; pause for review after each phase; move to `docs/plans/done/` when all done):
> - [x] Phase 0 — `EventPopupComponent` + global theme CSS + i18n key
> - [x] Phase 1 — `roulette-container.component` (7 templates, 19 call sites)
> - [x] Phase 2 — `storage-pc.component` (`pcInfoModal`)
> - [x] Phase 3 — Battle roulette family (base + gym/rival/elite-four/champion)
> - [x] Phase 4 — New Experience explainer roulettes (victory-road, team-rocket, find-item, find-ability-capsule)
> - [x] Phase 5 — Confirm-dialog family (restart, stats×2, market restock)
> - [x] Phase 6 — Dead-CSS cleanup + release notes + README

## Context

Source design: claude.ai/design project "Modal popups redesign" (`Event Popup Redesign.dc.html`, imported via the `claude_design` MCP). It specifies one card layout: centered title + thin gold underline, a flex row with an image tile and/or a boxed message panel, and a footer with a gold pill button. Dark/light color values in the mockup (`cardBg #232629`/`#f5f6fa`, `textColor #dfe6e9`/`#2d3436`, tile bg/border `rgba(255,255,255,0.06)`/`rgba(255,255,255,0.18)` dark, `rgba(0,0,0,0.035)`/`rgba(51,51,51,0.22)` light) are **identical** to the existing Market/PC/Pokédex modal theming already in `src/styles.css` — this redesign is visually consistent with, not a departure from, the app's established modal language.

## User decisions (locked)

1. **Image slots are flexible (0, 1, or 2), not forced to exactly one.** Evolution/trade/Team-Rocket-intro keep both sprites flanking the message; threat/confirm dialogs stay text-only; the rival `faintedModal` stays image-only.
2. **One new shared standalone component, `EventPopupComponent`**, consumed by all ~20 popups/dialogs (not 20 independent CSS reskins).
3. **Font: inherit the app's existing `"Pokemon GB"` global font** (do not adopt the mockup's literal `Courier New`).
4. **Dark theme: `theme-starters` gets the same card colors as `theme-plain-dark`** (matches the Market/PC/Pokédex precedent; not the distinct gold-bordered `share-card` treatment).
5. **Scope: 20 popups/dialogs total** — the original 16 gameplay event/announcement popups **plus** `restartGameModal` (restart-game-button), `resetStatsModal` + `sectionResetModal` (stats.component), `restockConfirmModal` (market.component). Market/PC/Pokédex *browsing* modals (grids/tabs) are **out of scope** — they already got their own redesign in recent commits. Mega Evolution's animation modal is **out of scope** (cinematic, not this skeleton).
5. **Backdrop: card only.** No custom backdrop/pattern behind the modal — rely on Bootstrap's default `.modal-backdrop` dimming, same as every other themed modal in the app.

## Component contract

New standalone component `EventPopupComponent`, opened as a **component type** (not a `TemplateRef`) via `NgbModal`/`ModalQueueService`, exactly like the existing `MegaEvolutionAnimationModalComponent`/`SelectFromTypeListRouletteComponent` precedent (`roulette-container.component.ts:812,1522`):

```ts
const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal' });
modalRef.componentInstance.title = '...';
modalRef.componentInstance.images = [...];
modalRef.componentInstance.lines = [...];
modalRef.componentInstance.buttons = [...];
```

- **All strings are pre-resolved by the caller** (`this.translateService.instant(key)`), never raw i18n keys — the component does no translation itself, matching `roulette-container`'s existing `infoModal` convention (the more general of the two existing `infoModal` conventions, since it already handles dynamic interpolation like appended Pokémon names).
- **Every button click closes the modal with its index**: `activeModal.close(i)`. Callers with a single default "Ok" button ignore the resolved value (same `modalRef.result.then(onDone, onDone)` pattern used today — resolve and reject already funnel to the same handler at every existing call site, so behavior is unchanged for Escape/backdrop-dismiss). Callers with 2 buttons branch on the index (see Phase 5).
- `windowClass: 'event-popup-modal'` is **required on every call site** — it's what lets `src/styles.css` theme the modal (see Phase 0). Two existing call sites currently use `windowClass: 'pc-modal'` / `'market-modal'` for theming (storage-pc's `infoModal`, market's `restockConfirmModal`) — both switch to `'event-popup-modal'` since they're getting entirely new markup.

## Verified current-system facts

- All popups today are `NgbModal`/`ModalQueueService`-opened `TemplateRef`s (`@ViewChild('xxx', {static:true})` + `<ng-template #xxx let-modal>`), never routed components, never inline `*ngIf`.
- `ModalQueueService` (`src/app/services/modal-queue-service/modal-queue.service.ts`, 48 lines) wraps `NgbModal` in a promise chain so popups opened in quick succession show sequentially instead of clobbering each other. Its `.open(content: Type<unknown> | TemplateRef<unknown>, options?: NgbModalOptions): Promise<NgbModalRef>` already accepts a component `Type` (proven by the Mega Evolution / type-list precedent) — no changes needed to this service.
- `closeModal()` methods scattered across host components call `this.modalService.dismissAll()` (dismiss-all, not scoped to one modal) — `EventPopupComponent` instead uses its own injected `NgbActiveModal.close(i)`, scoped to itself, which is more correct and behaves identically here since only one modal is ever open at a time (`ModalQueueService` serializes them).
- Exactly **two** existing call sites already pass a `windowClass` for theming: `storage-pc.component.ts:115` (`'pc-modal'`, on the `infoModal`/`pcInfoModal` template) and `market.component.ts:232` (`'market-modal'`, on `restockConfirmModal`). Every other one of the 20 popups passes no `windowClass` today and renders as an untheed plain-white Bootstrap card in all three themes.
- CSS class names duplicated near-verbatim across ~13 files today: `.modal-body`, `.modal-footer`, `.message`/`.quotes`/`.dialog` (the "GameBoy message bubble": white bg, black 2px double box-shadow border, 8.6px Pokemon-GB text), `.item-panel`/`.explain-panel`/`.pokemon-switch-panel`/`.leader-panel`/`.elite-panel`/`.champion-panel`/`.rival-panel`/`.team-rocket-panel`/`.info-panel`/`.restart-panel` (all identical `display:flex; flex-direction:row; align-items:center; justify-content:center`). These become dead code once each host migrates (Phase 6 removes them file by file).
- `market.component.ts`'s `restockConfirmModal` closes via the template's own `let-modal` context (`(click)="confirmRestock(); modal.close()"` / `(click)="modal.dismiss()"`), the only call site using this mechanism instead of a host `closeModal()` method — migrates to the new index-based `activeModal.close(i)` pattern like everything else.
- The base-battle-roulette doc comment claiming "champion uses NgbModal directly" (`base-battle-roulette.component.ts:261`) is **stale** — `ChampionBattleRouletteComponent` has no override and uses the same `ModalQueueService` path as gym/rival/elite-four. Don't trust that comment during migration.

---

## Phase 0 — `EventPopupComponent` + global theme CSS + i18n key

### 0.1 NEW `src/app/interfaces/event-popup-image.ts`

```ts
export interface EventPopupImage {
  /** Provide exactly one of src/emoji. */
  src?: string;
  /** Glyph shown instead of an <img> (e.g. coinsFoundModal's 🪙) — sized to roughly match `height`. */
  emoji?: string;
  alt?: string;
  /** px, default 128 (64 for the smaller item/capsule-found popups). Also used to size an emoji's font-size. */
  height?: number;
}
```

### 0.2 NEW `src/app/interfaces/event-popup-button.ts`

```ts
export interface EventPopupButtonConfig {
  label: string;
  variant?: 'primary' | 'secondary';
}
```

### 0.3 NEW `src/app/event-popup/event-popup.component.ts`

```ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { EventPopupImage } from '../interfaces/event-popup-image';
import { EventPopupButtonConfig } from '../interfaces/event-popup-button';

/**
 * Shared card for every gameplay event/announcement popup and confirm dialog
 * (evolutions, threats, rewards, battle intros, restart/reset confirms, etc).
 * Always opened as a component (not a TemplateRef) with
 * windowClass: 'event-popup-modal' so src/styles.css can theme it (see the
 * body.theme-* rules there). Callers pre-resolve every string via
 * translateService.instant(...) before setting inputs — this component does
 * no translation of its own.
 */
@Component({
  selector: 'app-event-popup',
  standalone: true,
  imports: [],
  templateUrl: './event-popup.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './event-popup.component.css'
})
export class EventPopupComponent {
  @Input() title = '';
  /** 0, 1, or 2 tiles. images[0] renders before the message box, images[1] after (evolution/trade-style flanking). */
  @Input() images: EventPopupImage[] = [];
  @Input() lines: string[] = [];
  /** Optional smaller/italic trailing line (e.g. ability-capsule's "assign later" hint). */
  @Input() hintLine?: string;
  @Input() buttons: EventPopupButtonConfig[] = [];

  constructor(public activeModal: NgbActiveModal) {}

  /** Closes with the clicked button's index so 2-button callers can branch (see restart/stats/market restock). */
  onButtonClick(index: number): void {
    this.activeModal.close(index);
  }
}
```

### 0.4 NEW `src/app/event-popup/event-popup.component.html`

```html
<div class="modal-body event-popup-body">
  @if (title) {
    <h1 class="event-popup-title">{{ title }}</h1>
    <div class="event-popup-underline"></div>
  }
  <div class="event-popup-row">
    @if (images[0]) {
      <div class="event-popup-tile">
        @if (images[0].emoji) {
          <span class="event-popup-tile-emoji" [style.font-size.px]="images[0].height ?? 96" aria-hidden="true">{{ images[0].emoji }}</span>
        } @else {
          <img [src]="images[0].src" [alt]="images[0].alt ?? ''" [style.height.px]="images[0].height ?? 128">
        }
      </div>
    }
    @if (lines.length || hintLine) {
      <div class="event-popup-message">
        @for (line of lines; track $index) {
          <p>{{ line }}</p>
        }
        @if (hintLine) {
          <p class="event-popup-hint">{{ hintLine }}</p>
        }
      </div>
    }
    @if (images[1]) {
      <div class="event-popup-tile">
        @if (images[1].emoji) {
          <span class="event-popup-tile-emoji" [style.font-size.px]="images[1].height ?? 96" aria-hidden="true">{{ images[1].emoji }}</span>
        } @else {
          <img [src]="images[1].src" [alt]="images[1].alt ?? ''" [style.height.px]="images[1].height ?? 128">
        }
      </div>
    }
  </div>
</div>
<div class="modal-footer event-popup-footer">
  @for (button of buttons; track $index; let i = $index) {
    <button type="button"
            class="event-popup-button"
            [class.event-popup-button-secondary]="button.variant === 'secondary'"
            (click)="onButtonClick(i)">{{ button.label }}</button>
  }
</div>
```

### 0.5 NEW `src/app/event-popup/event-popup.component.css`

Deviation from the mockup, deliberate: the mockup uses a fixed 140×140 square tile sized for one specific sprite. Real content varies (128px Pokémon sprites, 64px item icons, non-square official-artwork), so the tile here **pads around whatever height the caller supplies** instead of forcing a fixed box — this avoids shrinking any existing sprite. Tile/message background+border colors are theme-dependent and come from the global rules in Phase 0.6 (component CSS cannot use `body.theme-*` selectors — emulated encapsulation, see `CLAUDE.md`); everything else here is theme-invariant. The mockup's `popIn` keyframe animation is dropped — Bootstrap's own modal fade/scale transition already covers this and every other themed modal in the app relies on it, so adding a second animation would double up.

**Post-Phase-4 mobile fix (user-reported):** on narrow viewports, `.event-popup-row`'s `flex-wrap: wrap` put tile0+message on one line and stranded tile1 alone on the next (evolution/trade/Team-Rocket-intro, the 2-image popups) — looked broken. Added `@media (max-width: 480px)` (same breakpoint `market.component.css` already uses) switching `.event-popup-row` to `flex-direction: column` so it stacks tile/message/tile vertically in DOM order instead; `.event-popup-message` gets `width: 100%; max-width: 280px` in that breakpoint so it doesn't inherit its desktop flex-basis as a height. Verified in a real mobile-width (375px) browser for both the evolution and Team Rocket popups; desktop layout unaffected.

```css
.event-popup-body {
  text-align: center;
  padding: 4px;
}

.event-popup-title {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.event-popup-underline {
  width: 44px;
  height: 3px;
  border-radius: 2px;
  background: #f9ca24;
  margin: 0 auto 20px;
}

.event-popup-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
}

.event-popup-tile {
  flex: 0 0 auto;
  border-radius: 12px;
  box-sizing: border-box;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid; /* color set by body.theme-* .event-popup-modal .event-popup-tile in styles.css */
}

.event-popup-tile img {
  display: block;
  max-width: 100%;
  object-fit: contain;
}

.event-popup-tile-emoji {
  line-height: 1;
}

.event-popup-message {
  flex: 1 1 200px;
  max-width: 320px;
  text-align: left;
  border-radius: 10px;
  padding: 14px 16px;
  box-sizing: border-box;
  background: rgba(128, 128, 128, 0.08);
  border: 1px solid rgba(128, 128, 128, 0.25);
}

.event-popup-message p {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.5;
}

.event-popup-message p:last-child {
  margin-bottom: 0;
}

.event-popup-hint {
  font-style: italic;
  opacity: 0.8;
}

.event-popup-footer {
  justify-content: center;
  gap: 16px;
}

.event-popup-button {
  border: none;
  border-radius: 999px;
  padding: 11px 30px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  background: #f9ca24;
  color: #5c4400;
}

.event-popup-button:hover {
  background: #f0bd12;
}

.event-popup-button-secondary {
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
}

.event-popup-button-secondary:hover {
  background: rgba(128, 128, 128, 0.15);
}
```

### 0.6 EDIT `src/styles.css` — add theming block

Add near the other `windowClass`-scoped modal blocks (after the Pokédex modal block, matching the Market/PC pattern exactly):

```css
/* ── Event popup modal (windowClass: 'event-popup-modal') ────────────────────
   Shared card for every gameplay event/announcement popup and confirm dialog
   (EventPopupComponent). Same treatment as Market/PC/Pokédex modals —
   Bootstrap's .modal-content ignores the app theme by default. theme-starters
   shares theme-plain-dark's colors (Market/PC/Pokédex precedent) — the design
   mockup's own dark-variant colors already match this scheme exactly. */
body.theme-plain-dark .event-popup-modal .modal-content,
body.theme-starters .event-popup-modal .modal-content {
  background: #232629;
  color: #dfe6e9;
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15), 0 16px 40px rgba(0, 0, 0, 0.55);
}

body.theme-plain-light .event-popup-modal .modal-content {
  background: #f5f6fa;
  color: #2d3436;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
}

body.theme-plain-dark .event-popup-modal .event-popup-footer,
body.theme-starters .event-popup-modal .event-popup-footer {
  border-color: rgba(255, 255, 255, 0.15);
}

body.theme-plain-light .event-popup-modal .event-popup-footer {
  border-color: rgba(51, 51, 51, 0.15);
}

body.theme-plain-dark .event-popup-modal .event-popup-tile,
body.theme-starters .event-popup-modal .event-popup-tile {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
}

body.theme-plain-light .event-popup-modal .event-popup-tile {
  background: rgba(0, 0, 0, 0.035);
  border-color: rgba(51, 51, 51, 0.22);
}
```

### 0.7 EDIT all six `src/assets/i18n/*.json` — add `common.ok`

`en.json` already has a top-level `"common": { "scrollHint": "..." }` block (lines 2-4) — add a sibling key:
```json
"common": {
  "scrollHint": "Scroll for more content",
  "ok": "Ok"
},
```
Same addition (English placeholder value `"Ok"`) in `de.json`, `es.json`, `fr.json`, `it.json`, `pt.json`.

### 0.8 NEW `src/app/event-popup/event-popup.component.spec.ts`

Standard Angular TestBed spec (match this repo's existing component-spec style, e.g. `gym-battle-roulette.component.spec.ts`). Cover:
1. No title/underline rendered when `title` is `''` (default).
2. Title + underline render when `title` is set.
3. Zero, one, and two images render the correct number of `.event-popup-tile` elements, and `images[1]` renders after `.event-popup-message` in DOM order. An image with `emoji` set renders a `.event-popup-tile-emoji` span (no `<img>`); an image with `src` set renders an `<img>` (no emoji span).
4. `lines` renders one `<p>` per entry inside `.event-popup-message`; `hintLine` adds one more `<p class="event-popup-hint">`.
5. `buttons` renders one `<button>` per entry; clicking button index `i` calls `activeModal.close(i)` (spy/mock `NgbActiveModal`).
6. `event-popup-button-secondary` class present only when `variant === 'secondary'`.

**Phase 0 acceptance:** `npm run test:local` green (new spec passes, nothing else touched yet). Nothing in the app calls `EventPopupComponent` yet — it's inert until Phase 1.

**⏸ Pause for review.**

---

## Phase 1 — `roulette-container.component` (7 templates, 19 call sites)

All within `src/app/main-game/roulette-container/roulette-container.component.{ts,html,css}`. Add `import { EventPopupComponent } from '../../event-popup/event-popup.component';`, `import { EventPopupImage } from '../../interfaces/event-popup-image';`, `import { EventPopupButtonConfig } from '../../interfaces/event-popup-button';`. `TranslateService` is presumably already injected (the container already calls `this.translateService.instant(...)` extensively for `infoModal` — confirm the constructor already has it; if not, add `private translateService: TranslateService` from `@ngx-translate/core`).

### 1.1 DELETE from `roulette-container.component.html`

Delete the 7 `<ng-template>` blocks entirely: `pkmnEvoModal` (276-290), `pkmnTradeModal` (292-306), `altPrizeModal` (246-259), `coinsFoundModal` (261-274), `itemActivateModal` (308-321), `infoModal` (323-335), `teamRocketFailsModal` (337-354). Delete the matching `@ViewChild` declarations in `.ts` (lines 257-265) and the now-templateless fields stay (`altPrizeText`, `altPrizeSprite`, `altPrizeDescription`, `pkmnEvoTitle`, `pkmnIn`, `pkmnOut`, `pkmnTradeTitle`, `coinsFoundAmount`, `currentContextItem`, `infoModalTitle`, `infoModalMessage`) **only if** still read elsewhere; grep each before deleting (`infoModalTitle`/`infoModalMessage` in particular are written at 12 call sites — keep the fields, just stop rendering them through a template; simplest is to keep assigning them as today, for no behavior change, then also build the `EventPopupComponent` inputs from the same values at the open call — see 1.3).

### 1.2 `pkmnEvoModal` → `showpkmnEvoModal()` (was lines 1672-1685)

```ts
private async showpkmnEvoModal(): Promise<void> {
  this.playItemFoundAudio();
  if (!this.settingsService.currentSettings.lessExplanations) {
    const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal' });
    modalRef.componentInstance.title = this.translateService.instant(this.pkmnEvoTitle);
    modalRef.componentInstance.images = [
      { src: this.$safeNavigationMigration(this.pkmnOut.sprite?.front_default), alt: this.translateService.instant(this.pkmnOut.text) },
      { src: this.$safeNavigationMigration(this.pkmnIn.sprite?.front_default), alt: this.translateService.instant(this.pkmnIn.text) }
    ];
    modalRef.componentInstance.lines = [
      `${this.translateService.instant('game.main.roulette.evolve.modal.your')} ${this.translateService.instant(this.pkmnOut.text)} ${this.translateService.instant('game.main.roulette.evolve.modal.to')} ${this.translateService.instant(this.pkmnIn.text)}!`
    ];
    modalRef.componentInstance.buttons = [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
    const onDone = () => this.finishCurrentState();
    modalRef.result.then(onDone, onDone);
  } else {
    this.finishCurrentState();
  }
}
```
Note `pkmnEvoTitle` was already being assigned the raw key `'game.main.roulette.evolve.modal.title'` (not translated) in `replaceForEvolution` — `.instant()` it here at open time, same as every other title in this file.

### 1.3 `pkmnTradeModal` → inside `performTrade()` (was lines 1241-1249ish)

Same pattern, message uses `game.main.trade.sent`/`game.main.trade.received` instead of the evolve keys, title `pkmnTradeTitle`. Same two-image array (`pkmnOut` then `pkmnIn`), same `common.ok` button, same `onDone`/`finishCurrentState` wiring guarded by `lessExplanations`.

### 1.4 `altPrizeModal` → 7 call sites (6 in `chooseWhoWillEvolve()`, 1 in `grantMegaStone()`)

None of the 7 attach a `.then()` today (fire-and-forget) — keep that. Replace each
```ts
this.modalQueueService.open(this.altPrizeModal, { centered: true, size: 'md' });
```
with
```ts
void this.openAltPrizeModal();
```
where `openAltPrizeModal` is a new private helper (avoids repeating the same 6-line component-instance setup 7 times):
```ts
private async openAltPrizeModal(): Promise<void> {
  const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal' });
  modalRef.componentInstance.title = this.translateService.instant(this.altPrizeText);
  modalRef.componentInstance.images = [{ src: this.altPrizeSprite }];
  modalRef.componentInstance.lines = [this.translateService.instant(this.altPrizeDescription)];
  modalRef.componentInstance.buttons = [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
}
```
`altPrizeText`/`altPrizeSprite`/`altPrizeDescription` are still assigned exactly as today immediately before each call; only the trailing `this.modalQueueService.open(...)` line at each of the 7 sites changes to `void this.openAltPrizeModal();`.

### 1.5 `coinsFoundModal` → inside `buyPotions()` (New Experience branch, line 549)

```ts
void this.openCoinsFoundModal();
```
```ts
private async openCoinsFoundModal(): Promise<void> {
  const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal' });
  modalRef.componentInstance.title = this.translateService.instant('game.main.altPrizes.foundCoins.title');
  modalRef.componentInstance.images = [{ emoji: '🪙', height: 96 }];
  modalRef.componentInstance.lines = [this.translateService.instant('game.main.altPrizes.foundCoins.desc', { amount: this.coinsFoundAmount })];
  modalRef.componentInstance.buttons = [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
}
```
Uses the `EventPopupImage.emoji` slot (Phase 0.1/0.4) instead of `src` — same 🪙 glyph as today, now sized/tiled consistently with every other popup's image tile.

### 1.6 `itemActivateModal` → inside `useEscapeRope()` (was lines 1687-1706)

Same `lessExplanations`-gated pattern as 1.2/1.3: title `${currentContextItem.text} ${'game.main.item.activates'}`, one image (`currentContextItem.sprite`), one line (`currentContextItem.description`), `common.ok` button, `onDone` wired the same way.

### 1.7 `infoModal` → 12 call sites, ALL unchanged except the final line

Every one of the 12 methods (`teamRocketAmbush`, `itemTheft`, `markedTarget`, `pokeballMalfunction`, `forcedRetreat`, `badOmen`, `spooked`, `scoutingReport`, `pcLockout`, `tollBooth`, `teamRocketDefeated`, `preparePokemonCapture`) already builds `this.infoModalTitle`/`this.infoModalMessage` as fully-resolved strings via `translateService.instant(...)` (see Phase-plan context above — this is the one popup family that's already caller-pre-resolved). Keep every line in each method **except** replace
```ts
this.modalQueueService.open(this.infoModal, { centered: true, size: 'md' });
```
with
```ts
void this.openInfoModal();
```
(all 12 sites, verbatim substitution) plus one new private helper:
```ts
private async openInfoModal(): Promise<void> {
  const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal' });
  modalRef.componentInstance.title = this.infoModalTitle;
  modalRef.componentInstance.lines = [this.infoModalMessage];
  modalRef.componentInstance.buttons = [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
}
```
No images (text-only threat explainers, per the flexible-slots decision).

### 1.8 `teamRocketFailsModal` → inside `stealPokemon()` (was lines 1164-1174)

3-line message (`game.main.rocket.entei.emerges/prevents/fine`), one image (hardcoded Entei artwork URL + `alt="Forte igual o Entei!"` — keep verbatim, it's an existing (Portuguese) alt string, not something this migration should "fix"), custom button label `game.main.rocket.entei.thanks` (not `common.ok` — keep the existing bespoke label):
```ts
private async showTeamRocketFailsModal(): Promise<void> {
  const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal' });
  modalRef.componentInstance.title = this.translateService.instant('game.main.rocket.fails');
  modalRef.componentInstance.images = [{ src: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/244.png', alt: 'Forte igual o Entei!' }];
  modalRef.componentInstance.lines = [
    this.translateService.instant('game.main.rocket.entei.emerges'),
    this.translateService.instant('game.main.rocket.entei.prevents'),
    this.translateService.instant('game.main.rocket.entei.fine')
  ];
  modalRef.componentInstance.buttons = [{ label: this.translateService.instant('game.main.rocket.entei.thanks'), variant: 'primary' }];
  const onDone = () => this.doNothing();
  modalRef.result.then(onDone, onDone);
}
```
Called from `stealPokemon()` in place of the old `this.modalQueueService.open(this.teamRocketFailsModal, {...}).then(...)` block: `void this.showTeamRocketFailsModal();`.

### 1.9 CSS cleanup for this file — defer to Phase 6

Don't delete `roulette-container.component.css` rules yet (other in-scope templates besides these 7 might still reference some class names during intermediate phases — actually none do, this file's CSS is self-contained — but keep the cleanup pass consolidated in Phase 6 across all files at once so it's one reviewable diff instead of scattered across phases).

**Phase 1 acceptance:** `npm run test:local` green. Manual: trigger an evolution (two sprites flank the message, gold underline, gold pill "Ok"), a mystery-egg alt-prize (one sprite left), a New-Experience threat (text-only, no tile), Team Rocket ambush failing (Entei art + 3 lines + custom button label), and finding coins (🪙 emoji tile, same as today) — verify all five in `plain-light` and `theme-starters`/`plain-dark`.

**⏸ Pause for review.**

---

## Phase 2 — `storage-pc.component` (`pcInfoModal`)

`src/app/trainer-team/storage-pc/storage-pc.component.ts` already injects `NgbModal` (`this.modalService`) — no `ModalQueueService` needed here (single one-off popup, not competing with others). Add the same three imports as Phase 1.

### 2.1 EDIT `showPCModal()` (was lines 104-117)

```ts
async showPCModal(): Promise<void> {
  if (this.wheelSpinning) {
    return;
  }

  if (this.currentGameState === 'team-rocket-encounter') {
    const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal' });
    modalRef.componentInstance.title = this.translate.instant('trainer.storage.unavailable');
    modalRef.componentInstance.lines = [this.translate.instant('trainer.storage.unavailableMessage')];
    modalRef.componentInstance.buttons = [{ label: this.translate.instant('common.ok'), variant: 'primary' }];
  } else {
    this.trainerTeam = this.trainerService.getTeam();
    this.storedPokemon = this.trainerService.getStored();
    void this.soundFxService.playSoundFx(this.pcTurningOn, 0.30);

    this.modalService.open(this.pcStorageModal, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      windowClass: 'pc-modal'
    });
  }
}
```
(Check the exact injected `TranslateService` field name in this file — the agent's report didn't confirm one exists; if absent, add `private translate: TranslateService` to the constructor, matching whatever naming convention the rest of the file uses.) Only the `if` branch changes — the `else` branch (`pcStorageModal`, still `windowClass: 'pc-modal'`) is untouched; that's a different, out-of-scope grid modal.

### 2.2 DELETE from `storage-pc.component.html`

The `<ng-template #pcInfoModal let-modal>` block (132-144). Delete `@ViewChild('pcInfoModal', ...) infoModal!: TemplateRef<any>;` (line 53) — **keep** the `infoModalTitle`/`infoModalMessage` fields only if nothing else in the file reads them (grep first; they were only ever written by `showPCModal()` and read by the now-deleted template, so they're very likely safe to delete too — remove them if grep confirms no other reference).

**Phase 2 acceptance:** `npm run test:local` green. Manual: open PC Storage during a Team Rocket encounter → themed `event-popup-modal` card (previously: plain white card, this was the visual-parity gap the research flagged — `pcInfoModal` never got the `.explain-panel`/`.message` bubble styling its sibling in `roulette-container` had). Opening PC Storage normally still shows the unrelated `pcStorageModal` grid unaffected.

**⏸ Pause for review.**

---

## Phase 3 — Battle roulette family (base + gym/rival/elite-four/champion)

This is the trickiest phase: `presentationModalRef`/`itemUsedModalRef` are currently **per-subclass TemplateRefs** sharing only field *names* (via `declare` shadowing) and two generic open-helpers on the abstract base. Content (leader/rival/elite/champion name, sprite, quotes, per-subclass i18n key prefixes) lives in each subclass. Genericizing cleanly means: the base gains one concrete helper that does the actual `EventPopupComponent` open + input wiring, and `openPresentationModal()`/`openItemUsedModal()` become **abstract**, implemented individually by each of the 4 subclasses (each supplies its own title/images/lines).

### 3.1 EDIT `src/app/main-game/roulette-container/roulettes/base-battle-roulette/base-battle-roulette.component.ts`

Add imports: `EventPopupComponent`, `EventPopupImage`, `EventPopupButtonConfig`, `NgbModalRef` (from `@ng-bootstrap/ng-bootstrap`). Confirm `TranslateService` is injected (add `protected readonly translateService = inject(TranslateService);` if not already present — check first, several subclasses already use `TranslatePipe` in templates but that doesn't guarantee the base class injects the service).

Delete field declarations (was lines 90-91):
```ts
protected presentationModalRef!: TemplateRef<unknown>;
protected itemUsedModalRef!: TemplateRef<unknown>;
```

Replace the concrete `openPresentationModal`/`openItemUsedModal` (was lines 348-354) with:
```ts
/** Shared open logic for both battle popups — subclasses supply their own content via openPresentationModal/openItemUsedModal. */
protected async openEventPopup(config: {
  title: string;
  images?: EventPopupImage[];
  lines?: string[];
  buttons?: EventPopupButtonConfig[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
}): Promise<NgbModalRef> {
  const modalRef = await this.modalQueueService.open(EventPopupComponent, {
    centered: true,
    size: config.size ?? 'lg',
    windowClass: 'event-popup-modal'
  });
  modalRef.componentInstance.title = config.title;
  modalRef.componentInstance.images = config.images ?? [];
  modalRef.componentInstance.lines = config.lines ?? [];
  modalRef.componentInstance.buttons = config.buttons ?? [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
  return modalRef;
}

protected abstract openPresentationModal(): void;
protected abstract openItemUsedModal(): void;
```
(Confirm the class itself is already declared `abstract class BaseBattleRouletteComponent` — the agent's report implies yes since it's a `@Directive()` base never instantiated directly; if it isn't literally the `abstract` keyword, add it — TypeScript requires the keyword for abstract methods.)

`closeModal()` (was lines 130-132) can stay as-is (`this.modalService.dismissAll()`) **only if** any non-migrated template in these 4 files still calls it — grep each `.html` after 3.2-3.5 for remaining `(click)="closeModal()"`; if none remain in a given subclass, that subclass's inherited `closeModal()` becomes dead but harmless (it's on the shared base, so don't delete it unless **none** of the 4 subclasses need it).

### 3.2 EDIT `gym-battle-roulette.component.{html,ts}`

**HTML**: delete the `<ng-template #presentationModalRef>`/`<ng-template #itemUsedModalRef>` blocks (lines 39-69).

**TS**: delete the two `@ViewChild(...) declare ...` lines (33-34). Add:
```ts
protected override openPresentationModal(): void {
  void this.openEventPopup({
    title: `${this.translateService.instant('game.main.roulette.gym.against')} ${this.translateService.instant(this.currentLeader.name)}!`,
    images: [{ src: this.currentLeader.sprite, alt: this.translateService.instant(this.currentLeader.name) }],
    lines: this.currentLeader.quotes.map(q => this.translateService.instant(q)),
    buttons: [{ label: this.translateService.instant('game.main.roulette.gym.go'), variant: 'primary' }],
    size: 'lg'
  });
}

protected override openItemUsedModal(): void {
  void this.openEventPopup({
    title: `${this.translateService.instant('game.main.roulette.gym.used')} ${this.translateService.instant(this.currentItem.text)}!`,
    images: [{ src: this.currentItem.sprite }],
    lines: [this.translateService.instant(this.currentItem.description)],
    size: 'md'
  });
}
```
(`openItemUsedModal`'s `buttons` omitted → base's `common.ok` default applies, matching the original's plain `Ok` button.)

### 3.3-3.5 EDIT `rival-battle-roulette`, `elite-four-battle-roulette`, `champion-battle-roulette` — same transformation

Same shape as 3.2, substituting each subclass's own field/key names:

| Subclass | opponent field | "against" key | "go" key | "used" key |
|---|---|---|---|---|
| rival | `currentRival` | `game.main.roulette.rival.against` | `game.main.roulette.rival.go` | `game.main.roulette.rival.used` |
| elite-four | `currentElite` | `game.main.roulette.elite.elite4` | `game.main.roulette.elite.go` | `game.main.roulette.elite.use` (note: "use" not "used" — existing inconsistency, keep as-is) |
| champion | `currentChampion` | `game.main.roulette.champion.champion` | `game.main.roulette.champion.go` | `game.main.roulette.champion.use` (also "use") |

Delete each file's `<ng-template>` blocks and `@ViewChild declare` lines identically to 3.2.

### 3.6 EDIT `rival-battle-roulette.component.ts` — `faintedModal` (image-only, raw `NgbModal`, not queued)

Delete the `<ng-template #faintedModal>` block (lines 74-86) and `@ViewChild('faintedModal', ...)` (line 38). Replace `onFinalLoss()`'s tail (was lines 86-87: `this.faintedPokemon = faintedMon; this.modalService.open(this.faintedModal, { centered: true, size: 'md' });`) with:
```ts
this.faintedPokemon = faintedMon;
this.openFaintedModal();
```
New private method (deliberately **not** routed through `ModalQueueService` — preserves the existing raw-`NgbModal` behavior noted in the research as the one battle popup not using the queue):
```ts
private openFaintedModal(): void {
  if (!this.faintedPokemon) return;
  const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal' });
  const instance = modalRef.componentInstance as EventPopupComponent;
  instance.title = `${this.translateService.instant(this.faintedPokemon.text)} ${this.translateService.instant('game.main.roulette.rival.fainted')}`;
  instance.images = [{ src: this.faintedPokemon.sprite?.front_default ?? '' }];
  instance.buttons = [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
}
```
No `.message`/lines — image-only, matching the original's image-only layout and the flexible-slots decision.

**Phase 3 acceptance:** `npm run test:local` green (check `gym-battle-roulette.component.spec.ts`/etc. don't assert on the deleted `@ViewChild` fields or template — the wheel-restyle plan's prior audit found battle specs only query `.battle-prep-*`, rendered when `prepPhase===true`, so this should be unaffected, but re-verify for these 4 specs specifically since this migration touches different parts of the same files). Manual: enter a gym battle → themed presentation popup with leader sprite + quotes + "Go!" gold button; use a potion mid-battle → themed item-used popup; lose to the rival with a non-Sturdy lead → themed image-only fainted popup (no message box). Repeat for elite-four and champion. All in both theme families.

**Implementation deviations found during execution (not in the original plan):**
- `GymLeader.sprite` is typed `string | string[]` (variant rounds start as an array of per-variant sprites before `resolveOpponentVariant()` narrows to one). The old live-template binding tolerated this implicitly; `EventPopupImage.src` is `string`, so each subclass's `openPresentationModal()` coerces with `Array.isArray(x.sprite) ? x.sprite[0] : x.sprite`.
- **Real bug found and fixed, empirically verified with Playwright:** `resolveOpponentVariant()` resolves the variant leader's name/sprite/quotes asynchronously (via `translate.get().pipe(take(1)).subscribe(... queueMicrotask(...))`), one microtask tick after `prepareOpponentForRound()` returns. The old ng-template was a *live* binding inside the host's own view, so it just re-rendered correctly once that microtask settled. `EventPopupComponent` instead takes a one-time `@Input` snapshot at open time — called synchronously before the resolution, it would freeze on the *unresolved* generic data (e.g. title "Battle against Cilan/Chili/Cress!" with all 3 quotes concatenated and the wrong sprite, confirmed by forcing a Gen 5 Unova round 0 gym battle in a live browser). Fixed by deferring the popup-open call in `onGameStateChange()` (base-battle-roulette.component.ts) by one `queueMicrotask` tick, so it runs strictly after `resolveOpponentVariant`'s own already-queued microtask (FIFO order) — re-verified empirically that the popup now shows the correctly resolved single-variant name/sprite/quote. Affects gym gen5(r0,r7)/gen7(r2,r4)/gen8(r3,r5), elite-four gen8(r0,r2), rival gen6, champion gen7.
- User decision: the evolution/trade two-sprite "flanking" popups (`showpkmnEvoModal`/`performTrade` in roulette-container) wrap onto two lines at `size: 'md'` (128px tiles + message exceed Bootstrap's ~500px modal-md width) — changed both to `size: 'lg'` per user's choice, confirmed on-screen at a realistic desktop width.

**⏸ Pause for review.**

---

## Phase 4 — New Experience explainer roulettes

Four small, mostly-standalone components, each with **exactly one** popup opened unconditionally in `ngOnInit()`/`onItemSelected()`. Same transformation shape each time: delete the `<ng-template>`, add the three imports, rewrite the open call to build `EventPopupComponent` inputs, keep the exact same close/callback wiring that already exists (some go through `ModalQueueService`, some through raw `NgbModal` — preserve whichever each file already uses, don't consolidate them onto one mechanism).

### 4.1 `elite-four-prep-roulette.component.{html,ts}` — `victoryRoadModal`

Delete `<ng-template #victoryRoadModal>` (12-29) and its `@ViewChild` (line 23). `ngOnInit()` (was lines 25-30) becomes:
```ts
async ngOnInit(): Promise<void> {
  const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'lg', windowClass: 'event-popup-modal' });
  modalRef.componentInstance.title = this.translateService.instant('game.main.roulette.elite.prep.victoryRoad');
  modalRef.componentInstance.images = [{ src: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/494.png', alt: 'Good Luck!' }];
  modalRef.componentInstance.lines = [
    this.translateService.instant('game.main.roulette.elite.prep.congrats'),
    this.translateService.instant('game.main.roulette.elite.prep.defeated'),
    this.translateService.instant('game.main.roulette.elite.prep.ready')
  ];
  modalRef.componentInstance.buttons = [{ label: this.translateService.instant('game.main.roulette.elite.prep.go'), variant: 'primary' }];
}
```
Add `private translateService: TranslateService` (from `@ngx-translate/core`) to the constructor — not currently injected in this file (it only imports `TranslatePipe` for the template).

### 4.2 `team-rocket-roulette.component.{html,ts}` — `teamRockerModal`

Delete `<ng-template #teamRockerModal>` (7-28) and its `@ViewChild` (line 24). This file injects `NgbModal` only (no `ModalQueueService`) — keep it that way, use `this.modalService.open(EventPopupComponent, ...)` directly (synchronous, no `await` needed) inside `ngOnInit()` (was lines 38-54), after building `this.outcomes` — replace the trailing
```ts
this.modalService.open(this.teamRockerModal, { centered: true, size: 'lg' });
```
with
```ts
const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'lg', windowClass: 'event-popup-modal' });
modalRef.componentInstance.title = this.translateService.instant('game.main.roulette.teamrocket.teamrocket');
modalRef.componentInstance.images = [
  { src: this.james.sprite, alt: this.james.name },
  { src: this.jessie.sprite, alt: this.jessie.name }
];
modalRef.componentInstance.lines = [
  this.translateService.instant('game.main.roulette.teamrocket.trouble'),
  this.translateService.instant('game.main.roulette.teamrocket.double')
];
modalRef.componentInstance.buttons = [{ label: this.translateService.instant('game.main.roulette.teamrocket.meowth'), variant: 'primary' }];
```
Add `TranslateService` injection (not currently present, only `TranslatePipe` imported).

### 4.3 `find-item-roulette.component.{html,ts}` — `itemExplainerModal`

Delete `<ng-template #itemExplainerModal>` (5-18) and its `@ViewChild` (line 35). This file already injects both `NgbModal` and `ModalQueueService`, and its close button called a bespoke `closeItemExplainerModal()` rather than a shared `closeModal()` — since `EventPopupComponent` closes itself, `closeItemExplainerModal()` becomes fully dead (delete it in this phase, not deferred to Phase 6, since it's local to this one file and trivially verified).

`onItemSelected()` (was lines 49-75) becomes:
```ts
onItemSelected(index: number): void {
  this.selectedItem = this.items[index];

  this.itemSpriteService.getItemSprite(this.selectedItem.name).pipe(take(1)).subscribe(response => {
    if (this.selectedItem && response) {
      this.selectedItem.sprite = response.sprite;
    }
  });

  void this.soundFxService.playSoundFx(this.itemFoundAudio, 0.25);
  void this.openItemExplainerModal();
}

private async openItemExplainerModal(): Promise<void> {
  if (!this.selectedItem) return;
  const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal', keyboard: false });
  modalRef.componentInstance.title = `${this.translateService.instant('game.main.roulette.item.found')} ${this.translateService.instant(this.selectedItem.text)}`;
  modalRef.componentInstance.images = [{ src: this.selectedItem.sprite ?? '', height: 64 }];
  modalRef.componentInstance.lines = [this.translateService.instant(this.selectedItem.description)];
  modalRef.componentInstance.buttons = [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
  const emit = () => { if (this.selectedItem) this.itemSelectedEvent.emit(this.selectedItem); };
  modalRef.result.then(emit, emit);
}
```
Note: the original template bound `[src]="$safeNavigationMigration(selectedItem?.sprite)" (error)="onSpriteError($event)"` — `EventPopupImage` has no `(error)` hook. Since `EventPopupComponent`'s `<img>` is fixed markup, sprite-load-failure fallback (`onSpriteError`/`ITEM_SPRITE_FALLBACK`) can't be wired per-caller without adding an `(error)` output to the shared component. **Add one**: extend `EventPopupImage` with an optional callback isn't idiomatic for a plain data `@Input`; instead have `EventPopupComponent` itself fall back to a broken-image class rather than a swapped src (simplest: skip the fallback behavior here and note it as a known regression for the user to confirm is acceptable, OR — preferred — resolve the fallback sprite URL up front before setting `images`, since `ItemSpriteService`/`ITEM_SPRITE_FALLBACK` is synchronously importable):
```ts
import { ITEM_SPRITE_FALLBACK } from '../../../../services/item-sprite-service/item-sprite.service';
...
modalRef.componentInstance.images = [{ src: this.selectedItem.sprite || ITEM_SPRITE_FALLBACK, height: 64 }];
```
This doesn't handle a sprite URL that *starts* valid but 404s at load time (the original `(error)` handler's actual use case) — flag this as a minor known behavior change (broken sprite shows an empty/alt-text box instead of swapping to the fallback) when reporting this phase, rather than silently dropping the guarantee.

### 4.4 `find-ability-capsule-roulette.component.{html,ts}` — `capsuleExplainerModal`

Delete `<ng-template #capsuleExplainerModal>` (5-19) and its `@ViewChild` (line 38). Same shape as 4.3 minus the sprite-fallback complication (capsule sprites are baked into data, no fetch/error path) — note the extra `.assign-hint` line maps to `hintLine`:
```ts
onCapsuleSelected(index: number): void {
  this.selectedCapsule = this.capsules[index];
  void this.soundFxService.playSoundFx(this.itemFoundAudio, 0.25);
  void this.openCapsuleExplainerModal();
}

private async openCapsuleExplainerModal(): Promise<void> {
  if (!this.selectedCapsule) return;
  const modalRef = await this.modalQueueService.open(EventPopupComponent, { centered: true, size: 'md', windowClass: 'event-popup-modal', keyboard: false });
  modalRef.componentInstance.title = `${this.translateService.instant('game.main.roulette.abilityCapsule.found')} ${this.translateService.instant(this.selectedCapsule.text)}`;
  modalRef.componentInstance.images = [{ src: this.selectedCapsule.sprite ?? '', height: 64 }];
  modalRef.componentInstance.lines = [this.translateService.instant(this.selectedCapsule.description)];
  modalRef.componentInstance.hintLine = this.translateService.instant('game.main.roulette.abilityCapsule.assignHint');
  modalRef.componentInstance.buttons = [{ label: this.translateService.instant('common.ok'), variant: 'primary' }];
  const emit = () => { if (this.selectedCapsule) this.capsuleSelectedEvent.emit(this.selectedCapsule); };
  modalRef.result.then(emit, emit);
}
```
Both 4.3 and 4.4 need `TranslateService` injected if not already (both files currently only import `TranslatePipe`).

**Phase 4 acceptance:** `npm run test:local` green. Manual: reach Victory Road (3-line congrats + Victini art), trigger a Team Rocket encounter (Jessie/James flanking 2-line message), find an item on the adventure wheel (64px icon + description, confirm a deliberately-broken sprite URL falls back to the local fallback image instead of erroring), find an ability capsule (64px icon + description + italic assign hint). All in both theme families.

**User decision:** `find-item-roulette`'s old `(error)` sprite-fallback handler (swaps a broken sprite for `ITEM_SPRITE_FALLBACK` mid-load) has no `EventPopupComponent` equivalent — only a null/empty sprite falls back now, not one that starts valid and 404s later. User confirmed accepting this narrow edge case rather than adding `fallbackSrc`/`(error)` support to `EventPopupImage`.

**⏸ Pause for review.**

---

## Phase 5 — Confirm-dialog family (restart, stats×2, market restock)

These are the newly-added-to-scope 2-button dialogs. `EventPopupComponent`'s `activeModal.close(i)` resolves `modalRef.result` with the clicked button's index — callers branch on it instead of wiring a separate action per button.

### 5.1 `restart-game-button.component.{html,ts}` — `restartGameModal`

Delete `<ng-template #restartGameModal>` (6-19) and its `@ViewChild` (line 33). `showRestartGameConfirmModal()` (was lines 36-44) becomes:
```ts
showRestartGameConfirmModal(): void {
  if (this.wheelSpinning) {
    return;
  }
  const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'lg', windowClass: 'event-popup-modal' });
  modalRef.componentInstance.title = this.translate.instant('game.restart.title');
  modalRef.componentInstance.lines = [this.translate.instant('game.restart.warning')];
  modalRef.componentInstance.buttons = [
    { label: this.translate.instant('game.restart.confirm'), variant: 'primary' },
    { label: this.translate.instant('game.restart.cancel'), variant: 'secondary' }
  ];
  modalRef.result.then((index: number) => {
    if (index === 0) {
      this.confirmRestart();
    }
  }, () => {});
}
```
`confirmRestart()` (was lines 45-48) drops its own `this.closeModal()` call (the popup already closed itself):
```ts
confirmRestart(): void {
  this.restartEvent.emit(true);
}
```
`closeModal()` (lines 50-52) is now unreferenced in this file — delete it (grep to confirm no other caller first — this component has no other modal).
Add `private translate: TranslateService` (from `@ngx-translate/core`) to the constructor — not currently injected here.

### 5.2 `stats.component.{html,ts}` — `resetStatsModal` + `sectionResetModal`

Delete both `<ng-template>` blocks (381-401) and both `@ViewChild` lines (49-50). `showResetConfirmModal()`/`confirmReset()` (was 91-101):
```ts
showResetConfirmModal(): void {
  const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'lg', windowClass: 'event-popup-modal' });
  modalRef.componentInstance.title = this.translate.instant('stats.reset.title');
  modalRef.componentInstance.lines = [this.translate.instant('stats.reset.warning')];
  modalRef.componentInstance.buttons = [
    { label: this.translate.instant('stats.reset.confirm'), variant: 'primary' },
    { label: this.translate.instant('stats.reset.cancel'), variant: 'secondary' }
  ];
  modalRef.result.then((index: number) => {
    if (index === 0) {
      this.statsService.reset();
    }
  }, () => {});
}
```
(`confirmReset()` becomes fully unused — delete it.) `showSectionResetConfirm()`/`confirmSectionReset()` (was 103-119) — same shape, title/warning keys built from `pendingResetSection` exactly as before:
```ts
showSectionResetConfirm(section: ResettableSection): void {
  this.pendingResetSection = section;
  const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'lg', windowClass: 'event-popup-modal' });
  modalRef.componentInstance.title = this.translate.instant(`stats.reset.section.${section}.title`);
  modalRef.componentInstance.lines = [this.translate.instant(`stats.reset.section.${section}.warning`)];
  modalRef.componentInstance.buttons = [
    { label: this.translate.instant('stats.reset.confirm'), variant: 'primary' },
    { label: this.translate.instant('stats.reset.cancel'), variant: 'secondary' }
  ];
  modalRef.result.then((index: number) => {
    if (index === 0) {
      switch (this.pendingResetSection) {
        case 'luck': this.statsService.resetLuckStats(); break;
        case 'runHistory': this.statsService.resetRunHistory(); break;
        case 'achievements': this.statsService.resetAchievements(); break;
      }
    }
    this.pendingResetSection = null;
  }, () => { this.pendingResetSection = null; });
}
```
(`confirmSectionReset()` becomes fully unused — delete it.) This file already injects `translate: TranslateService` (constructor line 63) — reuse it, no new injection needed. `closeModal()` (was 121-123) — grep the rest of `stats.component.html` for other `(click)="closeModal()"` uses before deciding whether to delete (this file may have other modals out of scope, e.g. import/export flows — don't touch those).

### 5.3 `market.component.{html,ts}` — `restockConfirmModal`

Delete `<ng-template #restockConfirmModal>` (112-120) and its `@ViewChild` (line 90). `openRestockConfirm()` (was lines 228-233) becomes:
```ts
openRestockConfirm(): void {
  if (!this.isAvailable || !this.canRestock || !this.canAffordRestock()) {
    return;
  }
  const modalRef = this.modalService.open(EventPopupComponent, { centered: true, size: 'sm', windowClass: 'event-popup-modal' });
  modalRef.componentInstance.lines = [this.translate.instant('market.restockConfirmMessage', { price: this.restockPrice })];
  modalRef.componentInstance.buttons = [
    { label: this.translate.instant('market.restockConfirmYes'), variant: 'primary' },
    { label: this.translate.instant('market.restockConfirmNo'), variant: 'secondary' }
  ];
  modalRef.result.then((index: number) => {
    if (index === 0) {
      this.confirmRestock();
    }
  }, () => {});
}
```
No `title` set (original had none — `EventPopupComponent` already hides the `<h1>`/underline when `title` is empty, per 0.4). Confirm `TranslateService` is injected in this file under whatever name it currently uses (add if absent — check the constructor list from the research; it wasn't shown injecting one, only `NgbModal`).
`confirmRestock()` itself needs **no change** — it never called `closeModal()`/`modal.close()` internally, that happened from the template; now the popup closes itself before `.then()` fires, so behavior is identical.

**Phase 5 acceptance:** `npm run test:local` green. Manual, each in both theme families: Restart Game → gold "Confirm"/outline "Cancel", confirm actually restarts, cancel does nothing and closes. Stats → Reset All and each section reset (Luck/Run History/Achievements) same pattern. Market → Restock button (when affordable) shows price message + Yes/No, Yes actually restocks and spends coins, No does nothing.

**⏸ Pause for review.**

---

## Phase 6 — Dead-CSS cleanup + release notes + README

### 6.1 Remove now-unused CSS rules

For each file touched in Phases 1-5, grep the file's `.html` for the old class names (`.modal-body`, `.pokemon-switch-panel`, `.item-panel`, `.explain-panel`, `.message`, `.quotes`, `.dialog`, `.leader-panel`, `.rival-panel`, `.elite-panel`, `.champion-panel`, `.team-rocket-panel`, `.info-panel`, `.restart-panel`, `.assign-hint`, `.modal-footer` where it was popup-specific) — if a class no longer appears in that file's `.html` at all, delete its rule from the matching `.css`. Do this file-by-file, not with a blanket cross-file rule, since a few of these class names (`.modal-footer` in particular) may still be used by an out-of-scope modal in the same file (e.g. `market.component.css`'s `.market-close`/`.market-close:hover` stay — those belong to the still-in-scope-elsewhere `marketModal` grid, not `restockConfirmModal`).

Files to check: `roulette-container.component.css`, `storage-pc.component.css` (confirmed already empty of these rules, skip), `gym-battle-roulette.component.css`, `rival-battle-roulette.component.css`, `elite-four-battle-roulette.component.css`, `champion-battle-roulette.component.css`, `elite-four-prep-roulette.component.css`, `team-rocket-roulette.component.css`, `find-item-roulette.component.css`, `find-ability-capsule-roulette.component.css`, `restart-game-button.component.css`, `stats.component.css` (confirmed already empty, skip), `market.component.css`.

Also remove the now-orphaned `body.theme-* .pc-modal ...` reference to `pcInfoModal` if `styles.css`'s PC-modal comment block mentions it by name (it doesn't — the block is scoped to `.pc-modal` generically and still applies to `pcStorageModal`/`abilityPickerModal`, so **no change needed** to that block; just confirm `pcInfoModal`'s own `windowClass: 'pc-modal'` reference is gone from Phase 2, which it is).

### 6.2 Version / release notes / README

Per the ongoing v3.15.1 redesign batch on `dev` (already the case for the last several commits) — **extend the existing 3.15.1 entry, don't bump the version.**

1. `src/app/data/release-notes.ts` — add a new key to the existing `v3_15_1` entry's `noteKeys` array (after `.6`):
```ts
noteKeys: [
  'whatsNew.v3_15_1.0',
  'whatsNew.v3_15_1.1',
  'whatsNew.v3_15_1.2',
  'whatsNew.v3_15_1.3',
  'whatsNew.v3_15_1.4',
  'whatsNew.v3_15_1.5',
  'whatsNew.v3_15_1.6',
  'whatsNew.v3_15_1.7',
],
```
2. `src/assets/i18n/en.json` — add `"7"` to the existing `whatsNew.v3_15_1` block (after `"6"`):
```json
"7": "💬 Every in-game popup — evolutions, threats, rewards, battle intros, restart/reset confirms — now shares one themed card design with a gold accent, instead of a plain white box."
```
Same key added to `de.json`/`es.json`/`fr.json`/`it.json`/`pt.json` with the same English text as placeholder.
3. `README.md` — add one bullet to "New features added on top of the original:" describing the unified themed event-popup redesign.

**Phase 6 acceptance:** `npm run test:local` green. Full manual sweep of the "Verification" list below in both theme families. Move this file to `docs/plans/done/event-popup-redesign.md`.

---

## Verification

`npm run test:local` after every phase.

Manual acceptance sweep (do once at the end of Phase 6, in `plain-light` AND `theme-starters`/`plain-dark`):
1. Every popup listed in "User decisions §5" renders the new gold-accented card (rounded corners, gold underline under the title, gold pill primary button) with readable contrast in both theme families — no dark-on-dark or light-on-light text.
2. 2-image popups (evolution, trade, Team Rocket intro) show both sprites flanking the message box.
3. 1-image popups (rewards, item-used, battle intros) show one tile before the message box.
4. Text-only popups (all New-Experience threats, restart/stats/market confirms) show no tile, just the centered message box.
5. Image-only popup (rival fainted) shows just the tile, no message box.
6. 2-button popups (restart, stats×2, market restock) show a gold primary + outline secondary pill; confirming actually performs the action, canceling does not.
7. `ModalQueueService`-backed popups (most of them) still queue correctly when two would otherwise fire back-to-back (e.g. an alt-prize popup immediately followed by another game-state transition that also opens a popup) — no overlap/clobbering.
8. Escape/backdrop-dismiss on a single-button popup still proceeds the game state (same as clicking the button) — verified by the `.then(onDone, onDone)` pattern preserved at every fire-and-forget call site.
