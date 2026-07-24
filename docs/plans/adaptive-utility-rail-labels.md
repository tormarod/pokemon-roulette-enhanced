# Adaptive utility-rail labels (content-driven collapse)

**Status:** Planned — not started.

**Depends on:** PR #56 ("Collapse main-panel utility buttons to icon-only on phones"), branch
`claude/mobile-panel-button-layout-zqlldt`. That PR wraps each pill label in
`<span class="panel-pill-label">`, keeps the coin word in `<span class="coin-label">`, adds
`aria-label`s to the three buttons, and adds `@media (max-width: 480px)` rules that hide those
labels. **This plan assumes PR #56 is merged first** — it removes those media queries and replaces
the fixed breakpoint with a content-driven mechanism. If #56 is not yet merged, do that first.

---

## Goal

Replace the fixed **480px** viewport breakpoint (from PR #56) that collapses the main-panel
utility buttons (**Acceder PC**, **Pokédex**, **Mercado**) and the coin word (**MONEDAS**) to
icon-only, with **content-driven collapse**: the labels hide exactly when they would not fit and
show when they do — independent of viewport width, translation length, or the device's system
font-scale.

### Why not a breakpoint

A media query only knows the viewport width, not whether *this* text, in *this* language, at *this*
system font size, actually overflowed. Two phones with the same CSS viewport but different Android
"display size" / "font size" settings overflow differently; Spanish "Acceder PC" is wider than
English "Access PC". A fixed 480px either collapses phones that had room (loses text needlessly) or
fails to collapse a wide-but-large-font phone (the original bug). Measuring the real layout removes
the guess.

---

## Current system (post-PR #56)

- `src/app/trainer-team/trainer-team.component.html` — the `.utility-rail` (a flex row) holds:
  `.trainer-tile` · `.utility-middle` (badges + `.utility-buttons` containing `<app-storage-pc>` and
  `<app-pokedex>`) · `.utility-right` (the `.coin-pill` with its `.coin-label`, and `<app-market>`;
  right column only rendered in New Experience Mode).
- The three buttons live in child components, each rendering `<button class="panel-pill-btn">` with
  an icon then `<span class="panel-pill-label">…</span>`:
  - `src/app/trainer-team/storage-pc/storage-pc.component.{html,css}`
  - `src/app/trainer-team/pokedex/pokedex.component.{html,css}`
  - `src/app/trainer-team/market/market.component.{html,css}` (icon is `<span class="market-button-icon">🏪</span>`)
- **Cross-component styling is done with inherited CSS custom properties**, never descendant
  selectors: Angular's emulated view encapsulation means a parent's `.foo .bar` cannot match a child
  component's element, but custom properties inherit through the DOM and pierce encapsulation. The
  panel already relies on this for `--panel-*` (see the header comment in
  `trainer-team.component.css`). **This plan uses the same mechanism** — do not attempt
  `.rail-compact .panel-pill-label { … }` from the parent CSS; it will silently not match.
- Each button CSS file currently has, from PR #56:
  ```css
  @media (max-width: 480px) { .panel-pill-label { display: none; } }
  ```
  (market also zeroes `.market-button-icon { margin-right: 0; }` in its query).
- `trainer-team.component.css` currently has, from PR #56:
  ```css
  @media (max-width: 480px) {
    .utility-rail { gap: 10px; padding: 12px; }
    .utility-right { width: auto; }
    .coin-label { display: none; }
  }
  ```

---

## Design

### Toggle mechanism: one inherited custom property, one class

A new attribute directive on `.utility-rail` toggles a single class `rail-compact` on that element.
`trainer-team.component.css` maps the class onto inherited custom properties; every label reads its
own `display` from a property (with a sensible fallback so it works even if the directive never
runs):

- `.panel-pill-label { display: var(--pill-label-display, inline); }` (in **each** of the three
  button CSS files — duplicated per this repo's per-component-CSS convention).
- `.market-button-icon { margin-right: var(--pill-icon-gap, 0.35em); }` (market only).
- `.coin-label { display: var(--coin-label-display, inline); }` (in `trainer-team.component.css`).
- On `.utility-rail.rail-compact` (in `trainer-team.component.css`), set:
  `--pill-label-display: none; --pill-icon-gap: 0; --coin-label-display: none;` plus the same
  `gap: 10px; padding: 12px;` and `.utility-rail.rail-compact .utility-right { width: auto; }`
  the media query used.

All labels collapse **together** (one rail-wide decision), for visual consistency — never a mix of
one button with text and another without.

### Measurement: synchronous expand → measure → maybe-collapse (no flash)

The directive measures whether, **when fully expanded**, any pill button's content is wider than the
space it's given. Because the buttons flex-shrink (their flex items have `min-width: 0`), an
overflow shows up as the button's own content overflowing its box, i.e. `scrollWidth > clientWidth`
on the `<button class="panel-pill-btn">` once the button clips (see the CSS backstop below).

`measure()` runs **synchronously**:
1. Remove `rail-compact` (expand — labels become `display: inline` via the fallback).
2. Read each `.panel-pill-btn`'s `scrollWidth` / `clientWidth` (this forces a synchronous reflow).
3. `overflow = any button has scrollWidth > clientWidth + 1`.
4. `classList.toggle('rail-compact', overflow)`.

Doing steps 1→4 in one synchronous function means the browser paints **only the final state** — the
transient expanded layout in step 1 never reaches the screen, so there is no flash.

### Triggers: ResizeObserver + MutationObserver

- **ResizeObserver** on `.utility-rail` → re-measure when the panel is resized (window resize, the
  main-game layout switching between side-by-side and stacked, etc.).
  - No observer loop: toggling `rail-compact` changes only the rail's *children*, not the rail's own
    outer size (the rail is full-width, parent-constrained), so it cannot retrigger its own
    ResizeObserver.
- **MutationObserver** on `.utility-rail` with `{ childList: true, characterData: true,
  subtree: true }` → re-measure when label/coin text changes (ngx-translate swapping languages
  rewrites the text nodes; the coin amount growing `9 → 10 → 100` widens the pill).
  - No observer loop: we do **not** observe `attributes`, and the `rail-compact` toggle is a class
    (attribute) change, so our own writes are not seen. Custom-property-driven `display` changes are
    not DOM mutations either.
- One synchronous `measure()` in `ngAfterViewInit` for the initial state (before first paint → no
  flash on load).

Run the observers **outside Angular** (`NgZone.runOutsideAngular`) — `measure()` only reads layout
and toggles a class on a DOM node; it changes no template bindings, so it must not trigger change
detection.

### CSS backstop (defense-in-depth, no JS)

Independently of the directive, make the label physically un-spillable so a warped collision can
never happen even for the frame before the directive runs, or if `ResizeObserver` is somehow
unavailable: add `overflow: hidden;` to `.panel-pill-btn` in each of the three button CSS files.
The label already has `white-space: nowrap`; clipping at the button edge turns any residual overflow
into a (still ugly but non-colliding) clip rather than text escaping the pill. This clip is also
exactly the `scrollWidth > clientWidth` signal the directive measures.

---

## Implementation steps

1. **New directive** `src/app/trainer-team/adaptive-labels.directive.ts`:
   ```ts
   import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';

   @Directive({ selector: '[appAdaptiveLabels]', standalone: true })
   export class AdaptiveLabelsDirective implements AfterViewInit, OnDestroy {
     private readonly host = inject(ElementRef<HTMLElement>);
     private readonly zone = inject(NgZone);
     private ro?: ResizeObserver;
     private mo?: MutationObserver;

     ngAfterViewInit(): void {
       const el = this.host.nativeElement;
       this.zone.runOutsideAngular(() => {
         this.ro = new ResizeObserver(() => this.measure());
         this.ro.observe(el);
         this.mo = new MutationObserver(() => this.measure());
         this.mo.observe(el, { childList: true, characterData: true, subtree: true });
       });
       this.measure();
     }

     ngOnDestroy(): void {
       this.ro?.disconnect();
       this.mo?.disconnect();
     }

     /** Synchronous expand → measure → maybe-collapse; single paint, no flash. */
     measure(): void {
       const el = this.host.nativeElement;
       el.classList.remove('rail-compact');
       let overflow = false;
       el.querySelectorAll<HTMLElement>('.panel-pill-btn').forEach((b) => {
         if (b.scrollWidth > b.clientWidth + 1) overflow = true;
       });
       el.classList.toggle('rail-compact', overflow);
     }
   }
   ```

2. **Wire the directive** into `TrainerTeamComponent`
   (`src/app/trainer-team/trainer-team.component.ts`): add `AdaptiveLabelsDirective` to the
   standalone component's `imports` array. In `trainer-team.component.html`, add the attribute to the
   rail: `<div class="panel-card utility-rail" appAdaptiveLabels>`.

3. **`trainer-team.component.css`** — remove the PR #56 `@media (max-width: 480px)` block; add:
   ```css
   .coin-label { display: var(--coin-label-display, inline); }
   .utility-rail.rail-compact {
     --pill-label-display: none;
     --pill-icon-gap: 0;
     --coin-label-display: none;
     gap: 10px;
     padding: 12px;
   }
   .utility-rail.rail-compact .utility-right { width: auto; }
   ```

4. **`storage-pc.component.css`** and **`pokedex.component.css`** — remove the PR #56
   `@media (max-width: 480px) { .panel-pill-label { display: none; } }` block; add:
   ```css
   .panel-pill-label { display: var(--pill-label-display, inline); }
   .panel-pill-btn { overflow: hidden; } /* backstop: label can never spill outside the pill */
   ```
   (Add `overflow: hidden` into the existing `.panel-pill-btn` rule rather than duplicating it.)

5. **`market.component.css`** — remove its PR #56 `@media` block; add:
   ```css
   .panel-pill-label { display: var(--pill-label-display, inline); }
   .market-button-icon { margin-right: var(--pill-icon-gap, 0.35em); }
   ```
   and add `overflow: hidden;` to the existing `.panel-pill-btn` rule.

6. **No i18n / template-string changes.** The `aria-label`s from PR #56 stay (buttons still lose
   their visible text in compact mode, so the accessible name must remain).

---

## Acceptance tests

Unit spec `src/app/trainer-team/adaptive-labels.directive.spec.ts` (Karma runs real Chromium, so
real layout is available):

- **Overflow → compact.** Mount a host `<div appAdaptiveLabels style="width:120px">` containing two
  `.panel-pill-btn` elements with `overflow:hidden` and long nowrap labels that cannot fit 120px.
  After `fixture.detectChanges()` + `flush`/`whenStable`, assert the host has class `rail-compact`.
- **Room → expanded.** Same host at `width:600px`. Assert the host does **not** have `rail-compact`.
- **Reacts to shrink.** Start wide (no `rail-compact`), set host width narrow, dispatch a resize /
  call `directive.measure()`, assert `rail-compact` is now present.
- **No flash of expanded on decision.** Assert `measure()` leaves the correct final class in a single
  synchronous call (call `measure()` directly and check `classList` immediately after — it must be
  correct without waiting a frame).

Manual / visual (real app, New Experience Mode, main panel):
- Narrow the panel until labels no longer fit → all three buttons and the coin word collapse to icons
  together, no text spilling outside any pill.
- Widen back → labels return together.
- Switch language ES→EN→DE at a width where ES overflows but EN fits → compaction updates without a
  reload.
- Verify in a dark theme **and** `plain-light` (per repo convention).

---

## Version / release notes

**Decided (maintainer): no version bump and no What's New entry.** This is invisible UX polish (same
feature, smarter trigger), not a player-facing change worth a release note. Ship it without touching
`package.json`, `RELEASE_NOTES`, or the locale `whatsNew` keys.
