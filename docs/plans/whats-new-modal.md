# Plan: "What's New" update modal

Status: **DRAFT — ready. One open decision (§6.1: where release notes live).**
Owner: tormarod
Last updated: 2026-07-16
Source: the "What's new update modal" item in `docs/todo/backlog.md`.

## 1. Goal

After a deploy that introduces **player-facing changes** (gameplay, new
features/items, balance), show a one-time modal summarizing what changed. **Do
NOT show it for silent releases** (performance, refactors, build/CI, deps, docs).

## 2. Current system (ground truth)

- **App version** lives in `package.json` (`"version": "2.0.0"`). It is **not
  currently exposed to the running app** — no `environment.ts` version field
  seen. Getting the version to the client is part of this work (see §4/§6).
- **Modals**: `ModalQueueService` (`services/modal-queue-service/`) serializes
  modal display over NgbModal — reuse it so this doesn't fight other startup
  modals (gym-leader intro, etc.).
- **Persisted prefs**: `SettingsService` (`pokemon-roulette-settings`) is the
  natural home for a `lastSeenVersion` field, or use a dedicated
  `pokemon-roulette-*` key.
- **i18n**: ngx-translate, strings in `assets/i18n/{en,de,es,fr,it,pt}.json`.
- **Entry points**: Credits/Coffee/Settings pages + their buttons — the place to
  add a manual "view changelog" affordance.

## 3. Design

- **Release-notes data** = the source of truth for *both* "is this release
  player-facing?" and the note text. A release is **silent by default**; it only
  shows a modal if it has a notes entry. This is exactly what encodes the
  "not for perf changes" rule — no entry, no modal.
- **Show-once, version-gated.** On startup: if `currentVersion !==
  lastSeenVersion` **and** there's a notes entry for a version newer than
  `lastSeenVersion`, enqueue the modal (via `ModalQueueService`). On dismiss,
  write `currentVersion` to `lastSeenVersion`.
- **First-ever visit** (no `lastSeenVersion`): treat as already-seen — set it to
  the current version silently, do **not** dump full history to a new player.
- **Multiple releases since last seen**: show the union of notes for every
  player-facing version in `(lastSeenVersion, currentVersion]`, newest first.
- **Manual re-open**: a "What's new / changelog" link near Credits that opens the
  same modal on demand (bypasses the version gate).

## 4. Notes data shape

```ts
interface ReleaseNotes { version: string; date?: string; notes: string[]; } // i18n keys
export const RELEASE_NOTES: ReleaseNotes[] = [ /* player-facing releases only */ ];
```
- `notes` entries are **i18n keys** (translate in all 6 locales), or plain text
  if that's too heavy for a fast-moving changelog — a §6 sub-decision.
- Comparison uses semver-ish ordering; keep a tiny compare helper (avoid pulling
  a dep for it).

## 5. Phases (checkpoint after each)

**Phase 1 — Version + store.** Expose the build version to the app (see §6.2);
add `lastSeenVersion` to `SettingsService` (or a dedicated key) with
default/first-visit handling. Unit tests for the gate logic (first visit, no new
notes, one new release, several). No UI yet.

**Phase 2 — Notes data + selection.** `RELEASE_NOTES` data file + a selector
that returns the notes to show for `(lastSeenVersion, currentVersion]`. Tests for
the range/ordering/empty cases.

**Phase 3 — Modal UI.** A `WhatsNewComponent` modal, enqueued via
`ModalQueueService` at startup when the selector returns entries; write
`lastSeenVersion` on dismiss. i18n strings. *Checkpoint: simulate a version bump
and confirm it shows once, then not again.*

**Phase 4 — Manual re-open + docs.** "What's new" entry near Credits; README
note; update this plan + remove the backlog item.

## 6. Open decisions

1. **Notes source** — a hand-curated `RELEASE_NOTES` data file (simple, full
   control over wording, player-facing entries only) **vs** deriving from
   Conventional-Commit types at build time (`feat`/balance → show,
   `perf`/`refactor`/`chore` → silent; automated but needs commit discipline and
   a build step). **Recommend the curated data file** — simpler, and the whole
   point is human-readable player-facing wording, which auto-generation does
   poorly.
2. **How the build learns its version** — inject `package.json` version via an
   Angular build define / generated `environment` field, vs hard-coding it in the
   notes data (the newest entry's version *is* the current version). If notes are
   a committed data file, option (b) needs no build plumbing at all. **Recommend
   (b)** to keep it zero-infra.
3. **i18n vs plain text** for notes — translate keys in all 6 locales (consistent
   but higher friction per release) vs plain English text (faster to ship, but
   untranslated). Lean: i18n keys, matching the rest of the app.
