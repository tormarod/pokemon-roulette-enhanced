# Plan: Evolution-line modal (redesign, v2)

**Status:** All phases implemented (Phases 0–5). Pending manual in-app spot-check by
the user and a decision on committing.
**Target version:** `3.15.0` (MINOR — new player-facing UI feature/screen)
**Supersedes:** an earlier v1 draft that embedded the evolution strip inside
`PokedexDetailModalComponent`. v1's Phases 1–3 were implemented, then scrapped after in-app review
(see Context below). This file is the current, approved plan.

## Context

v1 embedded an evolution-line strip inside the existing `PokedexDetailModalComponent` (big
official-artwork hero image, form/mega selector buttons, evolution strip bolted on below). After
building and testing it (Phases 1–3 complete, 908 tests green), the user reviewed it in the running
app and flagged real problems: the reveal animation felt too quick, the evolution row was too small
while the main sprite was too big, the modal's size visibly jumped around (driven by artwork size
and whether the mega-button row was present), a pre-existing bug meant Mega-form stats didn't update
when selecting a Mega form, and Pokémon names in the strip weren't legible in dark mode (buttons
don't inherit ancestor text color).

Rather than patch those issues on the old design, the user asked to scrap it and go back to the
design board — then supplied an approved, fully-built design prototype via the Claude Design MCP:
project `08d887e1-f2f8-4aa6-b04c-a62762c6dedf`, file `Evolution Popover.dc.html`. That file is a
complete, working reference implementation (HTML/CSS/JS) of the new design and is the authoritative
source for this plan — every visual/behavioral detail below (colors, timings, keyframes, layout) is
transcribed directly from it, not re-derived. Despite its filename, the design is a **centered
modal-style overlay** (fixed backdrop + centered card, its own close button), not an anchored
tooltip-style popover — v1's `PokedexDetailModalComponent` embedding is replaced with a **new,
dedicated, compact modal component**, opened via `NgbModal` exactly like other modals in this app
(matches the ability-picker/PC-storage stacking pattern already proven in this codebase).

The new design directly resolves every complaint: no giant hero sprite (so no modal-size jumping),
bigger circular evolution tiles, a slower/springier reveal animation with exact keyframes, and —
significantly — its own self-contained Mega-form handling (locked/unlocked padlock state, correct
per-form power via direct lookup) that sidesteps the old Mega-stats bug entirely rather than fixing
it. That old bug lives in `PokedexDetailModalComponent`, which this plan reverts to pristine and
does not touch — it's logged as a separate backlog item, not fixed here (see "Out of scope" below).

## Design source of truth

Fetched via `DesignSync` (`get_project`/`list_files`/`get_file`) from the project above. Files:
`Evolution Popover.dc.html` (layout + component logic, reproduced/adapted below) and
`assets/Mega_Evolution_symbol.png` (small badge icon overlaid on Mega tiles).

Key structural facts extracted from the prototype (all confirmed against real app data during
planning, not assumed):
- Centered card, `width: min(680px, 92vw)`, dark backdrop (`rgba(0,0,0,0.55)`), header with a
  dex-number label + Pokémon name + a bordered `×` close button.
- Evolution row: circular tiles (78px), sprite 64px, staggered reveal on open only (`stage-reveal`
  keyframe, 220ms stagger, 0.7s duration, `cubic-bezier(0.3,1.4,0.5,1)` — a bouncy overshoot "pop":
  the tile scales past 1.0 to 1.06 and lifts to `translateY(-2px)` at the 60% mark before settling),
  arrows between tiles (`arrow-reveal`, 0.5s, now also scales in from `scaleX(0.4)`).
  Selecting a different tile does **not** replay the row's reveal — only the stats panel re-fades.
  (Updated after initial design review — the first pass felt too quick; stagger and durations were
  roughly doubled and an overshoot "pop" was added to both the tile reveal and the card's own
  entrance. Values below are the current, final ones — transcribed from the latest fetch.)
- Mega forms are appended after the base row: a single mega renders as one more inline tile behind
  an arrow; two-or-more render as a vertical "branch spine" (a left border + horizontal connector
  per tile) — this reuses the same tile visual language, just stacked instead of inline.
- Locked Mega tiles (mega stone not yet obtained) show dimmed (`opacity:0.55`), a 🔒 overlay, and
  are `disabled` (not selectable/clickable at all).
- Selecting a stage updates a stats panel below the row: type icons (64px, no label) + a "Power
  X/Y" pip bar (small rounded rectangles, green-filled up to `power`, gray beyond), plus a gold
  "MEGA EVOLUTION" badge and (only if locked) a "Requires a mega stone to Mega Evolve." note when
  the selected stage is a Mega form.
- Colors are the app's real theme palette (`#2d3436`/`#dfe6e9` — identical hex values already used
  in `styles.css` for `body.theme-plain-dark`/`body.theme-plain-light`), confirming the design was
  built against this app's actual dark/light system, not a generic mockup.

## Real-data details confirmed during planning (not assumptions)

- `EvolutionService.getEvolutionLine()` (built in v1, **unchanged, fully reusable**) already returns
  fully-resolved `PokemonItem[][]` columns — each entry already carries `type1`/`type2`/`power`, so
  the new component needs **no extra `PokemonService` calls** for base stages.
- `pokemonMegaForms` (`src/app/services/trainer-service/pokemon-mega-forms.ts`) is keyed by the
  **base (final-stage) pokemonId** (e.g. `3` → Venusaur's megas, `6` → Charizard's X/Y) and each
  entry is already a complete `PokemonItem` (power/types baked in) — so **no extra lookups needed**
  for Mega stages either. Confirmed no currently-defined mega form is keyed to a mid-evolution or
  branch-sibling id that would complicate the "append after the row" placement.
- The "locked" flag for a Mega tile maps to `PokedexService.currentPokedex.caught[String(baseId)]?.mega`
  (`PokedexEntry.mega`, set permanently by `PokedexService.markMega()` the first time the player
  actually mega-evolves that species in battle — confirmed in `pokedex.service.ts`). This is a
  read-only check; nothing about the "locked" flag depends on which mega stone is *currently held*
  (that's a battle-time-only mechanic), so no `TrainerService` dependency is needed here.
- `formatPokemonNumber` (zero-pad to 3 digits, `#025`; no padding at 1000+, `#1011`) is copied
  verbatim from the old `PokedexDetailModalComponent` (3-line pure function, not worth extracting a
  shared util for).
- Type icons reuse the app's existing `getTypeIconUrl()` (`src/app/interfaces/pokemon-type.ts`) —
  **not** the prototype's hardcoded `generation-viii/brilliant-diamond-shining-pearl` icon set — so
  the modal matches the type icons already used everywhere else in the app (tooltips, old modal).
  Just rendered bigger (64px) here.
- Sprite URLs use the **official-artwork** set (`.../sprites/pokemon/other/official-artwork/{id}.png`),
  same base the old modal used for its (now-removed) hero image, just applied per-tile at 64px
  instead of once at full size. Add a per-tile `(error)` fallback to a placeholder, mirroring the
  old modal's `hasError`/`fallbackUrl` pattern, since not every custom/homebrew form-alias id is
  guaranteed to exist in PokeAPI's official-artwork set.

## Deliberate adaptations from the raw prototype (flag if you disagree)

The prototype's JS is demo scaffolding for a fixed 2-line dataset (Bulbasaur/Charizard, both purely
linear, no branches) — it is not literal production logic. Adaptations made translating it to real,
branching data:
1. **Initial selected stage** = the `pokemonId` that was clicked (i.e. whichever stage the player
   actually owns), not "always jump to the final evolution" as the demo's `openPopover()` stub does
   — that stub behavior only existed because the demo's fake "team slot" always represented the
   base form. Real players click whichever stage they own.
2. **Branching base chains** (Eevee's 7+ evolutions, Nincada→Ninjask/Shedinja, Wurmple's two paths,
   Pichu as Pikachu's pre-evolution) aren't covered by the demo's linear-only sample data. These
   reuse the same "branch spine" visual the prototype defines for multi-Mega branching, applied to
   whichever column has 2+ entries — visually consistent with the design's own vocabulary rather
   than inventing a new pattern.
3. Reveal animation replays on modal open only, not on stage reselection (this matches the
   prototype's actual `selectStage()` logic — `revealTick` only increments in `openPopover()` — so
   this one isn't really an adaptation, just calling it out since v1's `viewStage()` replayed the
   whole strip on every click, which this explicitly does not).

## Out of scope (flagged, not bundled)

- The pre-existing Mega-form-stats-not-updating bug in `PokedexDetailModalComponent` (used only by
  the Pokédex browser) is unrelated to this feature now that the evolution modal is a separate
  component with its own correct Mega power handling. Add a `docs/todo/backlog.md` entry describing
  it (root cause: `alternateForms`'s mega-form mapping in that component drops the `power` field
  when converting a mega `PokemonItem` to a `PokemonForm`, and `PokemonForm` has no `power` field to
  carry it) rather than fixing it in this plan.
- Not adding a "Tap to view evolution line" hint caption to the roster/PC screens — that text in the
  prototype's outer mockup was scaffolding to explain the demo, not a real requirement; the existing
  hover tooltip already establishes that these sprites are interactive.

---

## Phase 0 — Revert the abandoned v1 UI (keep the data layer) ✅ DONE

All v1 changes were uncommitted, so this was a full `git checkout --` revert (not a partial edit) of
the files whose *only* changes were the abandoned modal-embedded strip:
`pokedex-detail-modal.component.{ts,html,css,spec.ts}`, `trainer-team.component.{ts,html,spec.ts}`,
`storage-pc.component.{ts,html,spec.ts}`, `src/assets/i18n/en.json`.

**Kept, not touched:** `src/app/services/evolution-service/evolution.service.ts` and its `.spec.ts`
— the Phase 1 data layer (`getEvolutionLine`, `hasEvolutionLine`, the reverse-chain builder) is
unchanged and fully reused by the new design.

`npm run test:local` confirmed a clean, fully-green baseline (899 tests) after the revert.

---

## Phase 1 — Import the Mega badge asset

Fetch the binary asset from the design project and write it into `public/` (this repo's convention
for root-served static images — see `public/dark-background.png`, `public/place-holder-pixel.png`;
referenced with a plain relative path, no `baseHref` prefix needed since it's a normal `<img src>`,
not an inline style url like the tiled background).

1. `DesignSync` → `get_file` with `projectId: "08d887e1-f2f8-4aa6-b04c-a62762c6dedf"`,
   `path: "assets/Mega_Evolution_symbol.png"` — returns base64 content (`isBase64: true`).
2. Decode and write to `public/mega-evolution-symbol.png`. Since the `Write` tool only accepts text
   content, decode via shell, e.g. (PowerShell):
   ```powershell
   [System.IO.File]::WriteAllBytes("public/mega-evolution-symbol.png", [System.Convert]::FromBase64String($base64Content))
   ```
   (Write the base64 string to a temp file first if it's too long for a single command argument.)
3. Verify the file is a valid PNG (`file public/mega-evolution-symbol.png` or just check it opens).

---

## Phase 2 — `EvolutionLineModalComponent`

**New files** (mirrors `pokedex-detail-modal`'s sibling location/naming under `src/app/pokedex/`,
since this is also a single-Pokémon detail modal opened via `NgbModal`):
- `src/app/pokedex/evolution-line-modal/evolution-line-modal.component.ts`
- `src/app/pokedex/evolution-line-modal/evolution-line-modal.component.html`
- `src/app/pokedex/evolution-line-modal/evolution-line-modal.component.css`
- `src/app/pokedex/evolution-line-modal/evolution-line-modal.component.spec.ts`

### Component shape (`.ts`)

```ts
import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { ThemeService } from '../../services/theme-service/theme.service';
import { EvolutionService } from '../../services/evolution-service/evolution.service';
import { PokedexService } from '../../services/pokedex-service/pokedex.service';
import { pokemonMegaForms } from '../../services/trainer-service/pokemon-mega-forms';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType, getTypeIconUrl } from '../../interfaces/pokemon-type';

interface EvolutionStageView {
  pokemonId: number;
  text: string;          // i18n key, from PokemonItem.text
  power: number;
  type1?: PokemonType;
  type2?: PokemonType | null;
  isMega: boolean;
  locked: boolean;       // only ever true for a Mega stage
  columnIndex: number;   // for base stages: chain depth. Mega stages get columnIndex = last base column + 1.
}

@Component({
  selector: 'app-evolution-line-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './evolution-line-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './evolution-line-modal.component.css'
})
export class EvolutionLineModalComponent implements OnInit {
  @Input() pokemonId!: number;

  darkMode!: Observable<boolean>;
  baseColumns: EvolutionStageView[][] = [];   // mirrors EvolutionService's column grouping
  megaStages: EvolutionStageView[] = [];      // flattened, appended after the row
  selectedId!: number;
  revealTick = 0;
  hasError = new Set<number>();               // per-tile sprite fallback tracking

  readonly fallbackUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/items/unknown.png';

  constructor(
    public activeModal: NgbActiveModal,
    private themeService: ThemeService,
    private evolutionService: EvolutionService,
    private pokedexService: PokedexService,
  ) {}

  ngOnInit(): void {
    this.darkMode = this.themeService.isDark$;
    this.selectedId = this.pokemonId;

    const columns = this.evolutionService.getEvolutionLine(this.pokemonId);
    this.baseColumns = columns.map((col, ci) => col.map(mon => this.toStageView(mon, ci, false)));

    const lastColumnIndex = columns.length - 1;
    const megaSourceIds = columns[lastColumnIndex].map(mon => mon.pokemonId);
    this.megaStages = megaSourceIds
      .flatMap(baseId => (pokemonMegaForms[baseId] ?? []).map(mega => ({ mega, baseId })))
      .map(({ mega, baseId }) => this.toStageView(mega, lastColumnIndex + 1, true, baseId));

    this.revealTick++;
  }

  private toStageView(mon: PokemonItem, columnIndex: number, isMega: boolean, megaBaseId?: number): EvolutionStageView {
    const locked = isMega && !this.pokedexService.currentPokedex.caught[String(megaBaseId)]?.mega;
    return {
      pokemonId: mon.pokemonId,
      text: mon.text,
      power: mon.power,
      type1: mon.type1,
      type2: mon.type2,
      isMega,
      locked,
      columnIndex,
    };
  }

  get allStages(): EvolutionStageView[] {
    return [...this.baseColumns.flat(), ...this.megaStages];
  }

  get selectedStage(): EvolutionStageView {
    return this.allStages.find(s => s.pokemonId === this.selectedId) ?? this.allStages[0];
  }

  get pipCap(): number {
    return Math.max(5, ...this.allStages.map(s => s.power));
  }

  get powerPipFilled(): boolean[] {
    return Array.from({ length: this.pipCap }, (_, i) => i < this.selectedStage.power);
  }

  selectStage(stage: EvolutionStageView): void {
    if (stage.locked) return;
    this.selectedId = stage.pokemonId;
  }

  isSelected(stage: EvolutionStageView): boolean {
    return stage.pokemonId === this.selectedId;
  }

  spriteUrl(id: number): string {
    const base = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
    return `${base}/${id}.png`;
  }

  onSpriteError(id: number): void {
    this.hasError.add(id);
  }

  displaySpriteUrl(id: number): string {
    return this.hasError.has(id) ? this.fallbackUrl : this.spriteUrl(id);
  }

  formatPokemonNumber(id: number): string {
    if (id >= 1000) return `#${id}`;
    return `#${id.toString().padStart(3, '0')}`;
  }

  getTypeIconUrl(type: PokemonType): string {
    return getTypeIconUrl(type);
  }

  // Reveal-order helper for staggered animation-delay, mirrors v1's revealDelayMs but flat
  // across [...baseColumns.flat(), ...megaStages] in render order. 220ms stagger step.
  revealDelayMs(stage: EvolutionStageView): number {
    const order = this.allStages.findIndex(s => s.pokemonId === stage.pokemonId);
    return order * 220;
  }
}
```

Notes on the above:
- `hasMultiMega` / `singleMega` branching from the prototype becomes a template-level check:
  `megaStages.length > 1` → branch-spine layout; `megaStages.length === 1` → one inline tile behind
  an arrow; `megaStages.length === 0` → nothing rendered after the base row.
- For branching **base** columns (`col.length > 1`), reuse the same branch-spine CSS treatment as
  multi-Mega (adaptation #2 above) rather than the old v1 `.evo-column` vertical stack — keeps one
  consistent "branch" visual language throughout.
- `revealDelayMs` intentionally does NOT change after `ngOnInit` (no `viewStage`-style reload) —
  `[style.animation-delay.ms]` is set once and the animation only plays because `revealTick`'s
  `@for/track` remount happens once, on open.

### Template shape (`.html`) — key structure, styled per the CSS below

```html
<div class="evo-modal-root" [ngClass]="(darkMode | async) ? 'evo-dark' : 'evo-light'">
  <div class="evo-header">
    <div>
      <div class="evo-dex-label">
        {{ formatPokemonNumber(selectedStage.pokemonId) }}
        @if (selectedStage.isMega) { · {{ 'evolutionModal.megaFormSuffix' | translate }} }
      </div>
      <div class="evo-name">{{ selectedStage.text | translate }}</div>
    </div>
    <button type="button" class="evo-close" (click)="activeModal.dismiss()" aria-label="Close">×</button>
  </div>

  @for (_ of [revealTick]; track revealTick) {
    <div class="evo-row">
      @for (column of baseColumns; track $index; let ci = $index) {
        @if (ci > 0) {
          <div class="evo-arrow evo-reveal" [style.animation-delay.ms]="column[0] ? revealDelayMs(column[0]) - 130 : 0">→</div>
        }
        @if (column.length === 1) {
          <button type="button" class="evo-tile evo-reveal"
                  [class.evo-tile-selected]="isSelected(column[0])"
                  [style.animation-delay.ms]="revealDelayMs(column[0])"
                  (click)="selectStage(column[0])">
            <span class="evo-tile-ring">
              <img class="evo-sprite" loading="lazy" [src]="displaySpriteUrl(column[0].pokemonId)"
                   [alt]="column[0].text | translate" (error)="onSpriteError(column[0].pokemonId)">
            </span>
            <span class="evo-tile-name">{{ column[0].text | translate }}</span>
          </button>
        } @else {
          <div class="evo-branch-spine">
            @for (stage of column; track stage.pokemonId) {
              <div class="evo-branch-item">
                <div class="evo-branch-connector"></div>
                <button type="button" class="evo-tile evo-tile-branch evo-reveal"
                        [class.evo-tile-selected]="isSelected(stage)"
                        [style.animation-delay.ms]="revealDelayMs(stage)"
                        (click)="selectStage(stage)">
                  <span class="evo-tile-ring">
                    <img class="evo-sprite" loading="lazy" [src]="displaySpriteUrl(stage.pokemonId)"
                         [alt]="stage.text | translate" (error)="onSpriteError(stage.pokemonId)">
                  </span>
                  <span class="evo-tile-name">{{ stage.text | translate }}</span>
                </button>
              </div>
            }
          </div>
        }
      }

      @if (megaStages.length === 1) {
        <div class="evo-arrow evo-reveal" [style.animation-delay.ms]="revealDelayMs(megaStages[0]) - 130">→</div>
        <button type="button" class="evo-tile evo-tile-mega evo-reveal"
                [class.evo-tile-selected]="isSelected(megaStages[0])"
                [class.evo-tile-glow]="isSelected(megaStages[0]) && !megaStages[0].locked"
                [style.animation-delay.ms]="revealDelayMs(megaStages[0])"
                [disabled]="megaStages[0].locked"
                (click)="selectStage(megaStages[0])">
          <span class="evo-tile-ring evo-ring-mega">
            <img class="evo-sprite" loading="lazy" [src]="displaySpriteUrl(megaStages[0].pokemonId)"
                 [alt]="megaStages[0].text | translate" (error)="onSpriteError(megaStages[0].pokemonId)">
            <img class="evo-mega-badge" src="mega-evolution-symbol.png" alt="Mega">
            @if (megaStages[0].locked) { <span class="evo-lock-overlay">🔒</span> }
          </span>
          <span class="evo-tile-name">{{ megaStages[0].text | translate }}</span>
        </button>
      } @else if (megaStages.length > 1) {
        <div class="evo-arrow evo-reveal" [style.animation-delay.ms]="revealDelayMs(megaStages[0]) - 130">→</div>
        <div class="evo-branch-spine">
          @for (stage of megaStages; track stage.pokemonId) {
            <div class="evo-branch-item">
              <div class="evo-branch-connector"></div>
              <button type="button" class="evo-tile evo-tile-branch evo-tile-mega evo-reveal"
                      [class.evo-tile-selected]="isSelected(stage)"
                      [class.evo-tile-glow]="isSelected(stage) && !stage.locked"
                      [style.animation-delay.ms]="revealDelayMs(stage)"
                      [disabled]="stage.locked"
                      (click)="selectStage(stage)">
                <span class="evo-tile-ring evo-ring-mega">
                  <img class="evo-sprite" loading="lazy" [src]="displaySpriteUrl(stage.pokemonId)"
                       [alt]="stage.text | translate" (error)="onSpriteError(stage.pokemonId)">
                  <img class="evo-mega-badge" src="mega-evolution-symbol.png" alt="Mega">
                  @if (stage.locked) { <span class="evo-lock-overlay">🔒</span> }
                </span>
                <span class="evo-tile-name">{{ stage.text | translate }}</span>
              </button>
            </div>
          }
        </div>
      }
    </div>
  }

  <hr class="evo-divider">

  @for (_ of [selectedId]; track selectedId) {
    <div class="evo-stats evo-stats-fade">
      <div class="evo-stats-types">
        <img class="evo-type-icon" [src]="getTypeIconUrl(selectedStage.type1!)" [alt]="selectedStage.type1">
        @if (selectedStage.type2) {
          <img class="evo-type-icon" [src]="getTypeIconUrl(selectedStage.type2)" [alt]="selectedStage.type2">
        }
      </div>
      <div class="evo-stats-power">
        <div class="evo-power-label">{{ 'detail.power' | translate }} {{ selectedStage.power }}/{{ pipCap }}</div>
        <div class="evo-power-pips">
          @for (filled of powerPipFilled; track $index) {
            <span class="evo-pip" [class.evo-pip-filled]="filled"></span>
          }
        </div>
      </div>
      @if (selectedStage.isMega) {
        <div class="evo-mega-tag">{{ 'evolutionModal.megaBadge' | translate }}</div>
      }
      @if (selectedStage.isMega && selectedStage.locked) {
        <div class="evo-locked-note">{{ 'evolutionModal.megaLocked' | translate }}</div>
      }
    </div>
  }
</div>
```

(`detail.power` is the **existing** i18n key already used by the roster/PC hover tooltip — reused
here rather than adding a duplicate. No "Types" label — the design shows icons only.)

### CSS (`.css`) — values transcribed directly from the design file

```css
.evo-modal-root {
  padding: 22px 24px 24px;
  border-radius: 14px;
  animation: card-pop 0.6s cubic-bezier(0.2, 0.8, 0.3, 1.1);
}
.evo-light { background: #f5f6fa; color: #2d3436; }
.evo-dark  { background: #232629; color: #dfe6e9; }

.evo-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
.evo-dex-label { font-size: 11px; opacity: 0.6; letter-spacing: 0.04em; }
.evo-name { font-size: 22px; font-weight: 700; color: inherit; }
.evo-close {
  background: none; border: 1px solid #333; border-radius: 8px;
  width: 32px; height: 32px; font-size: 16px; cursor: pointer; color: inherit; line-height: 1;
}

.evo-row {
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
  gap: 6px 10px; padding: 18px 4px 8px; overflow-x: auto;
}

.evo-tile {
  border: none; background: none; padding: 6px; display: flex; flex-direction: column;
  align-items: center; gap: 4px; cursor: pointer; border-radius: 12px;
}
.evo-tile:disabled { cursor: not-allowed; opacity: 0.55; }
.evo-tile-branch { flex-direction: row; align-items: center; gap: 10px; }

.evo-tile-ring {
  width: 78px; height: 78px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; position: relative; background: rgba(128, 128, 128, 0.12);
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}
.evo-tile-branch .evo-tile-ring { width: 64px; height: 64px; }

.evo-tile-selected .evo-tile-ring { background: rgba(46, 125, 50, 0.16); box-shadow: 0 0 0 3px #2e7d32; }
.evo-tile-mega.evo-tile-selected .evo-tile-ring { background: rgba(249, 202, 36, 0.16); box-shadow: 0 0 0 3px #f9ca24; }

.evo-sprite { width: 64px; height: 64px; object-fit: contain; transition: transform 0.18s ease; }
.evo-tile-branch .evo-sprite { width: 52px; height: 52px; }
.evo-tile-selected .evo-sprite { transform: scale(1.08); }

.evo-mega-badge {
  position: absolute; right: -2px; bottom: -2px; width: 22px; height: 22px;
  border-radius: 999px; background: #fff; box-shadow: 0 0 4px rgba(0, 0, 0, 0.5); padding: 2px;
}
.evo-tile-branch .evo-mega-badge { width: 18px; height: 18px; }

.evo-lock-overlay {
  position: absolute; inset: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}

.evo-tile-name { font-size: 11px; text-align: center; max-width: 90px; line-height: 1.15; color: inherit; }
.evo-tile-selected .evo-tile-name { font-weight: 700; }

.evo-arrow { font-size: 22px; opacity: 0.55; }

.evo-branch-spine {
  display: flex; flex-direction: column; gap: 14px;
  border-left: 2px solid rgba(128, 128, 128, 0.4); padding-left: 16px; margin-left: 2px;
}
.evo-branch-item { position: relative; }
.evo-branch-connector {
  position: absolute; left: -16px; top: 50%; width: 16px; height: 2px;
  background: rgba(128, 128, 128, 0.4); transform: translateY(-50%);
}

.evo-divider { border: none; height: 1px; background: rgba(128, 128, 128, 0.35); margin: 14px 0 16px; }

.evo-stats { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.evo-stats-types { display: flex; gap: 6px; }
.evo-type-icon { width: 64px; height: auto; }
.evo-stats-power { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px; }
.evo-power-label { font-size: 12px; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.04em; }
.evo-power-pips { display: flex; gap: 4px; }
.evo-pip { width: 26px; height: 10px; border-radius: 3px; border: 1px solid #333; background: rgba(128, 128, 128, 0.25); }
.evo-pip-filled { background: #2e7d32; }

.evo-mega-tag {
  font-size: 11px; font-weight: 700; color: #7a5b00;
  background: linear-gradient(135deg, #ffe9a8, #ffd257); border: 1px solid #333;
  border-radius: 6px; padding: 4px 8px;
}
.evo-locked-note { font-size: 11px; opacity: 0.7; }

/* Reveal animations (final values — see "Design source of truth" note on the animation revision) */
.evo-reveal { opacity: 0; animation: stage-reveal 0.7s cubic-bezier(0.3, 1.4, 0.5, 1) both; }
.evo-arrow.evo-reveal { animation: arrow-reveal 0.5s ease-out both; }
@keyframes stage-reveal {
  0%   { opacity: 0; transform: translateY(14px) scale(0.65); }
  60%  { opacity: 1; transform: translateY(-2px) scale(1.06); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes arrow-reveal {
  from { opacity: 0; transform: translateX(-16px) scaleX(0.4); }
  to   { opacity: 1; transform: translateX(0) scaleX(1); }
}
@keyframes card-pop {
  0%   { opacity: 0; transform: scale(0.94) translateY(10px); }
  65%  { opacity: 1; transform: scale(1.01) translateY(-1px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
.evo-stats-fade { animation: stats-fade 0.45s ease-out both; }
@keyframes stats-fade {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.evo-tile-glow .evo-tile-ring { animation: mega-glow 1.6s ease-in-out infinite; }
@keyframes mega-glow {
  0%, 100% { box-shadow: 0 0 0 3px #f9ca24, 0 0 14px 2px rgba(249, 202, 36, 0.55); }
  50%      { box-shadow: 0 0 0 3px #f9ca24, 0 0 22px 6px rgba(249, 202, 36, 0.85); }
}
@media (prefers-reduced-motion: reduce) {
  .evo-reveal, .evo-modal-root, .evo-stats-fade { animation: none !important; opacity: 1 !important; transform: none !important; }
  .evo-tile-glow .evo-tile-ring { animation: none !important; }
}
```

### `src/styles.css` addition (global, unscoped — required)

`NgbModal` renders `.modal-content`/`.modal-dialog` outside this component's encapsulated template
(Bootstrap-generated chrome), so component-scoped CSS can't reach it — same reasoning already
documented in this file for `.share-card`/`.achievement-tile`/`.achievement-toast-host`. Add:

```css
/* ── Evolution line modal (strips Bootstrap's default modal chrome so our
   own card styling — see evolution-line-modal.component.css — shows through) ── */
.evolution-line-modal-dialog { max-width: min(680px, 92vw); }
.evolution-line-modal-dialog .modal-content {
  background: transparent;
  border: none;
  box-shadow: none;
}
```

### Spec (`.spec.ts`) — acceptance tests

- Mock `EvolutionService` (`getEvolutionLine`), `PokedexService` (`currentPokedex`), `ThemeService`.
- Bulbasaur (columns `[[1],[2],[3]]`, no megas): `ngOnInit` → `baseColumns.length === 3`,
  `megaStages.length === 0`, `selectedId === 1` (input pokemonId), template renders 3 `.evo-tile`
  (non-branch) and 2 `.evo-arrow`.
- Selecting a different stage (`selectStage(stageForId(3))`) updates `selectedId` **without** a
  second call to `evolutionService.getEvolutionLine` (assert call count stays 1) and without
  incrementing `revealTick`.
- Species with a single Mega (e.g. Venusaur, mock `pokemonMegaForms`-equivalent via the mocked
  `getEvolutionLine` last column + inject the real `pokemonMegaForms` import — or stub the module
  import isn't mockable, so use Bulbasaur/Venusaur's real id `3` in the mocked line and let the
  real `pokemonMegaForms[3]` resolve): `megaStages.length === 1`; `pokedexService.currentPokedex.caught['3'].mega`
  unset → `megaStages[0].locked === true`; set `.mega = true` → `locked === false`.
  species with 2 megas (id `6`, Charizard): `megaStages.length === 2`, branch-spine path taken
  (template renders `.evo-branch-spine` inside the mega section).
- `selectStage` on a locked stage is a no-op (`selectedId` unchanged).
- `pipCap` is `max(5, ...powers)` — assert `5` for an all-power-≤5 line, and the actual higher value
  when a Mega's power exceeds 5.
- `formatPokemonNumber` unit tests (padded/unpadded), copied from the old modal's spec.

---

## Phase 3 — Entry points (roster + PC storage)

Re-wire exactly like v1's Phase 3 (same NgbModal-based click-to-open pattern, proven already this
session, just retargeted at the new component and modal options):

### `trainer-team.component.ts` / `.html`
- Inject `NgbModal` as `modalService` (constructor param).
- Import `EvolutionLineModalComponent` from `../pokedex/evolution-line-modal/evolution-line-modal.component`.
- Add:
  ```ts
  openEvolutionDetail(pokemon: PokemonItem | undefined): void {
    if (!pokemon) return;
    const ref = this.modalService.open(EvolutionLineModalComponent, {
      centered: true,
      modalDialogClass: 'evolution-line-modal-dialog',
    });
    ref.componentInstance.pokemonId = pokemon.pokemonId;
  }
  ```
- Roster `<img>` (lines ~22-28): `triggers="hover click"` → `triggers="hover"` (frees up click for
  the modal, matches v1's fix), add `role="button"`, `style="cursor:pointer"`,
  `(click)="openEvolutionDetail(trainerTeam[i])"`.
- Verify in-app that clicking the mega-stone overlay button doesn't also open the modal (sibling
  elements, not nested — same non-issue already verified in v1).

### `storage-pc.component.ts` / `.html`
- `NgbModal` already injected as `modalService`. Add the same `openEvolutionDetail(pokemon: PokemonItem)`
  method + import.
- Team-list `<img>` (no explicit `triggers` today, defaults to `hover focus` — no conflict): add
  `role="button"`, `cursor:pointer`, `(click)="openEvolutionDetail(pokemon)"`.
- Stored-list `<img>` (currently `triggers="hover click"`): change to `triggers="hover"` (same
  toggle-conflict fix as roster), add the same click wiring.
- Modal stacks correctly above the open `#pcStorageModal` — already proven via the ability-picker
  pattern in this exact file.

### Specs
- `trainer-team.component.spec.ts` / `storage-pc.component.spec.ts`: spy `NgbModal.open`, assert
  it's called with `EvolutionLineModalComponent` and `jasmine.objectContaining({ modalDialogClass: 'evolution-line-modal-dialog' })`,
  and `componentInstance.pokemonId` set correctly. (Directly reuses the test shape already written
  and passing in v1 — just swap the expected component class and options object.)

---

## Phase 4 — i18n, release notes, README, version bump, backlog

### 4a. New i18n keys — all six locale files (`src/assets/i18n/{en,de,es,fr,it,pt}.json`)
Add a new top-level object:
```json
"evolutionModal": {
  "megaFormSuffix": "Mega Form",
  "megaBadge": "MEGA EVOLUTION",
  "megaLocked": "Requires a mega stone to Mega Evolve."
}
```
`en` real text as above; other five may reuse the English text as placeholder if not translated.
(No "doesn't evolve" key needed — a single-stage species just renders one tile with no arrows,
which communicates it without extra text; no "Types" label needed — the design shows icons only.)

### 4b. What's-New release notes
- `package.json`: bump `version` to `3.15.0`.
- `src/app/data/release-notes.ts`: prepend:
  ```ts
  {
    version: '3.15.0',
    date: '<ship date, YYYY-MM-DD>',
    noteKeys: ['whatsNew.v3_15_0.0'],
  },
  ```
- All six locale files: add
  ```json
  "v3_15_0": {
    "0": "🧬 Tap any Pokémon in your team or PC to see its full evolution line, including Mega Evolutions you've unlocked."
  }
  ```
  `en` real, others English placeholder if not translated.

### 4c. README
Add a bullet to "New features added on top of the original" describing the evolution-line modal
(owned-Pokémon evolution + Mega-form inspection from roster + PC).

### 4d. Backlog
Add one entry to `docs/todo/backlog.md` for the pre-existing `PokedexDetailModalComponent` Mega-stats
bug (see "Out of scope" above for the exact root cause to record).

---

## Phase 5 — Verify

- `npm run test:local` — full suite green.
- `npm run build` — production build clean.
- Manual in-app (`npm start`):
  - Click a roster Pokémon → modal opens centered, fixed width (doesn't jump size), reveal animation
    plays left-to-right once, feels deliberate (not instant).
  - Click a different stage in the row → tile ring/scale updates instantly, stats panel below
    re-fades, row does **not** replay its reveal.
  - A species with one Mega (Venusaur/Blastoise/etc.): Mega tile appended behind an arrow; locked
    (dimmed + 🔒) if `.mega` unset in the Pokédex, unlocked (gold ring, glow when selected, correct
    higher power in the pip bar) once set.
  - A species with two Megas (Charizard): branch-spine layout, not inline.
  - Non-evolving species (Tauros): single tile, no arrows, stats still correct.
  - Branching base species (Eevee, Nincada): branch-spine renders correctly for that column.
  - Open PC storage → click a stored/team Pokémon → modal stacks above the PC modal correctly;
    Revive button and mega-stone overlay button still work without also opening the modal.
  - Dark mode and light mode: card background/text colors correct, Mega gold badge/glow legible in
    both, `×` close button visible in both.
  - `prefers-reduced-motion: reduce` disables all animation/glow.
