# Plan: "What's New" update modal

Status: **✅ COMPLETE**
Owner: tormarod
Last updated: 2026-07-16

## Goal

On app load, show a one-time modal listing player-facing changes since the
player last saw it. Silent releases (perf/refactor/etc.) carry no notes entry, so
no modal ever appears for them.

## Decisions (chosen by owner — do not re-open)

- **Version source = the newest release-notes entry.** No `package.json`/build
  plumbing (confirmed: `environment` has no version). `CURRENT_VERSION =
  RELEASE_NOTES[0].version`; array is newest-first. A silent release adds no
  entry, so `CURRENT_VERSION` doesn't advance and the modal can't fire.
- **Notes are i18n keys**, translated in all 6 locales (en/de/es/fr/it/pt).
- **`lastSeenVersion` is a dedicated `localStorage` key** managed by
  `WhatsNewService` — NOT in `SettingsService`.
- **Manual re-open lives inside the Settings screen** (a row that opens the
  modal) — no standalone button.
- **First visit shows the current notes once** (revised 2026-07-16): empty
  `lastSeenVersion` is treated as `'0.0.0'`, so a first-time visitor sees the
  current release notes once (then close stamps `CURRENT_VERSION`). This was
  chosen so the 2.1.0 notes reach every existing player on the feature's first
  deploy, rather than being silently suppressed.

## Files

Create: `src/app/data/release-notes.ts`,
`src/app/services/whats-new-service/whats-new.service.ts`,
`src/app/whats-new/whats-new.component.{ts,html,css}`.
Edit: `src/app/app.component.ts`, `src/app/settings/settings.component.{ts,html}`,
`src/assets/i18n/en.json` (+ de/es/fr/it/pt).

## 1. `src/app/data/release-notes.ts`

```ts
export interface ReleaseNotes { version: string; date?: string; noteKeys: string[]; }

// Newest first. Add an entry ONLY for player-facing releases.
// noteKeys are i18n keys defined in every locale file (see §5).
export const RELEASE_NOTES: ReleaseNotes[] = [
  // SEED: replace with the real current release before shipping.
  { version: '2.1.0', date: '2026-07-16', noteKeys: ['whatsNew.v2_1_0.0', 'whatsNew.v2_1_0.1'] },
];

export const CURRENT_VERSION = RELEASE_NOTES[0]?.version ?? '';

/** >0 if a>b, <0 if a<b, 0 if equal. Numeric dot-segments, missing = 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
```

**Key naming convention:** `whatsNew.v<major>_<minor>_<patch>.<index>` (e.g.
`whatsNew.v2_1_0.0`). Every key must exist in all 6 locale files.

## 2. `src/app/services/whats-new-service/whats-new.service.ts`

```ts
@Injectable({ providedIn: 'root' })
export class WhatsNewService {
  private readonly STORAGE_KEY = 'pokemon-roulette-last-seen-version';
  pendingEntries: ReleaseNotes[] = [];

  constructor(private modalQueue: ModalQueueService) {}

  private getLastSeen(): string { return localStorage.getItem(this.STORAGE_KEY) ?? ''; }
  private setLastSeen(v: string): void { localStorage.setItem(this.STORAGE_KEY, v); }

  /** Call once at startup. */
  maybeShowOnStartup(): void {
    // First-time visitor (no stored version) is treated as 0.0.0, so the current
    // notes show once; openModal() stamps CURRENT_VERSION on close so it won't repeat.
    const last = this.getLastSeen() || '0.0.0';
    const toShow = RELEASE_NOTES.filter(n => compareVersions(n.version, last) > 0);
    if (toShow.length === 0) return;
    this.openModal(toShow);
  }

  /** Manual re-open (Settings row); shows full history, no gate. */
  showWhatsNew(): void { this.openModal(RELEASE_NOTES); }

  private async openModal(entries: ReleaseNotes[]): Promise<void> {
    this.pendingEntries = entries;
    const ref = await this.modalQueue.open(WhatsNewComponent, { centered: true, size: 'lg', scrollable: true });
    ref.result.finally(() => this.setLastSeen(CURRENT_VERSION));
  }
}
```

## 3. `WhatsNewComponent` (modal body)

Standalone component. `.ts`: inject `WhatsNewService` + `NgbActiveModal`; expose
`entries = this.whatsNew.pendingEntries`; `close()` calls `activeModal.dismiss()`.
`.html`: title `{{ 'whatsNew.title' | translate }}`; `@for (r of entries; track
r.version)` render `r.version`, optional `r.date`, then `@for (key of r.noteKeys;
track key)` as list items `{{ key | translate }}`; dismiss button
`{{ 'whatsNew.dismiss' | translate }}` → `close()`. Mirror an existing modal
component's styling (e.g. gym-leader or mega-evolution modal). Import
`TranslatePipe`.

## 4. `AppComponent` edit

- Import `afterNextRender` from `@angular/core`; inject `private whatsNew: WhatsNewService`.
- In the constructor body: `afterNextRender(() => this.whatsNew.maybeShowOnStartup());`

## 5. i18n — `src/assets/i18n/en.json` (then translate the same keys in de/es/fr/it/pt)

```json
"whatsNew": {
  "title": "What's New",
  "dismiss": "Got it",
  "settingsEntry": "What's New",
  "v2_1_0": {
    "0": "Type matchups now reward defensive resistances and coverage.",
    "1": "New Statistics screen: runs, win rate, achievements, and more."
  }
}
```
(`whatsNew.v2_1_0.0` resolves via ngx-translate's nested-key lookup.) Each future
release adds a new `v<x>_<y>_<z>` block to all 6 files.

## 6. Settings-screen entry

- `src/app/settings/settings.component.ts`: inject `private whatsNew: WhatsNewService`;
  add `openWhatsNew(): void { this.whatsNew.showWhatsNew(); }`.
- `src/app/settings/settings.component.html`: add a row/button mirroring an
  existing settings row, labeled `{{ 'whatsNew.settingsEntry' | translate }}`,
  with `(click)="openWhatsNew()"`.

## Tests (`whats-new.service.spec.ts`)

Use a fresh `localStorage` (clear in `beforeEach`); mock `ModalQueueService.open`
to return `Promise.resolve({ result: Promise.resolve() } as any)`.
1. First visit (key absent): `open` IS called with all `RELEASE_NOTES`; after the
   modal closes, `localStorage` key == `CURRENT_VERSION`.
2. Key == `CURRENT_VERSION`: `open` NOT called.
3. Key older than a notes entry: `open` called once; `pendingEntries` = only the
   newer entries.
4. After the modal closes: key == `CURRENT_VERSION`.
5. `showWhatsNew()`: `open` called with all `RELEASE_NOTES`.
6. `compareVersions`: `'2.10.0' > '2.9.0'`, `'2.1.0' == '2.1.0'`, `'2.0.0' < '2.1.0'`.

## Steps

1. Create `release-notes.ts` (§1).
2. Create `WhatsNewService` (§2) + `WhatsNewComponent` (§3).
3. Wire `AppComponent` (§4).
4. Add i18n keys to all 6 locale files (§5).
5. Add the Settings-screen row (§6).
6. Add tests; `npm run test:local` green.
7. Replace the seed `RELEASE_NOTES[0]` + its i18n keys with the real current
   release before shipping. Mark plan done → `docs/plans/done/`; remove the
   backlog entry.
