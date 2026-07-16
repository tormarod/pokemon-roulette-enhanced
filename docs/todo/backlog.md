# Backlog: Pending changes, bug fixes, TODOs

Owner: tormarod
Last updated: 2026-07-16

> Running list, tracked in git so collaborators can see it. Not a shipped
> changelog — just a place to park things noticed mid-session that aren't
> worth fixing right now, or that need a decision before they become a plan.
> Add an entry whenever something comes up; move it to `docs/plans/` if it
> grows into an actual multi-phase plan, and delete the entry here once done.

---

## Open items

### **[CRITICAL] Memory leak in WheelComponent subscriptions**

Two unmanaged subscriptions to `translateService.get('wheel.spin')` in `ngAfterViewInit()` (line 81) and `ngOnChanges()` (line 124) lack cleanup in `ngOnDestroy()`. Component destruction leaks memory over repeated navigation. 

**Fix**: Add `takeUntilDestroyed()` or implement `ngOnDestroy()` to unsubscribe.

---

### **[CRITICAL] Copy-paste bug in items.component.html**

Line 38 calls `getItemSprite(5)` but should call `getItemSprite(6)` — the 7th item slot shows the same sprite as the 6th instead of its own.

**Fix**: Change `getItemSprite(5)` → `getItemSprite(6)`.

---

### **[CRITICAL] Memory leak in StatsService constructor**

Subscription to `trainerService.getTeamObservable()` (lines 60–67) in constructor lacks cleanup. While services persist for the app lifetime, subscriptions should still be managed.

**Fix**: Use `takeUntilDestroyed()` with a DestroyRef or manual cleanup.

---

### **[HIGH] Incomplete error handling in roulette-container modal chains**

Modal promise chains (lines 701–706, 771–775, 1193–1197, etc.) in `roulette-container.component.ts` lack `.catch()` handlers. Unhandled modal dismissals could throw silently.

**Fix**: Add `.catch()` handlers or wrap in try-catch blocks.

---

### **[HIGH] Type safety: `any` type in ModalQueueService**

`modal-queue.service.ts` uses `any` for content (line 13) and optional reason (line 45), weakening type safety.

**Fix**: Replace with proper typed parameters (e.g., `Type<any> | TemplateRef<any>`).

---

### **[MEDIUM] Performance: 13× subscriptions to darkMode in items.component**

Template lines 2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57, 62 all have `(darkMode | async)`, creating 13 separate subscriptions to the same observable.

**Fix**: Subscribe once in component and bind a property, or use `shareReplay()`.

---

### **[MEDIUM] Inconsistent subscription cleanup patterns across components**

Components use mixed patterns: `takeUntilDestroyed()`, manual unsubscribe, and `Subscription.add()`. `WheelComponent` has **no cleanup at all**. Hard to maintain and error-prone.

**Fix**: Standardize on `takeUntilDestroyed()` for all new subscriptions; audit existing components for consistency.

---

### **[MEDIUM] Production console.logging**

`console.log()`, `console.error()`, `console.warn()` statements in production code (`coffee.component.ts`, `pokedex.service.ts`, `stats.service.ts`, etc.) should use a proper logging service or be removed.

**Fix**: Remove or route to debug logger conditionally.

---

### **[LOW] Pending technical debt TODOs**

`pokedex.service.ts` lines 36 and 149 mention temporary shiny propagation bridge and migration logic needing cleanup in the next task.

---

### "What's new" update modal on deploy of player-facing changes

Show a modal to the player after a deploy that introduces **gameplay changes,
new features, new items, balance tweaks, etc.** — summarizing what changed.
**Must NOT pop up for silent releases** (performance, efficiency, refactors,
build/CI, dependency bumps, docs) — those ship without bothering the player.

Why: players should notice new content/mechanics; they should not be interrupted
by a modal for invisible under-the-hood work.

Sketch (decide when this becomes a plan):
- **Version-gated, show-once.** Compare the app's current version against a
  `last-seen-version` in `localStorage` (own `pokemon-roulette-*` key, or fold
  into `SettingsService`). Only show when it advanced *and* the new release is
  flagged player-facing.
- **Explicit player-facing flag per release** is what encodes the "not for perf
  changes" rule — a release is silent unless it carries notes. Options to weigh:
  a curated release-notes data file (list of `{ version, notes[] }`, player-facing
  entries only), vs. deriving from Conventional-Commit types (`feat`/balance →
  show, `perf`/`refactor`/`chore` → silent). The data file is simpler and gives
  control over wording; the commit-derived route automates but needs discipline.
- On dismiss, write the current version to `last-seen-version` so it won't
  reappear. First-ever visit (no stored version) should NOT dump full history —
  treat as already-seen.
- i18n the notes (all 6 locales) like other user-facing strings.

Open questions: where release notes live (data file vs generated); manual "view
changelog again" entry point (e.g. near Credits); how the deployed build learns
its version + player-facing flag (build-time inject vs committed data file).

### In-game player suggestions / bug-report + "most wanted" feedback

Let players submit feature suggestions and bug reports from the page, and give
the owner a view of what players most want. **Not yet decided — options below;
needs a direction before it becomes a plan.**

Hard constraint: the game is a **static SPA on GitHub Pages, no backend, no
player accounts**. So the real questions are *where feedback lands* and *how
much player friction is acceptable*. Two sub-goals pull apart: "open an issue in
the repo" (centralize with the owner) vs. "see what players most want" (needs
**voting/aggregation** — raw issues/forms don't give that).

Repo reality (checked 2026-07-16): repo is **public**, but **Issues and
Discussions are both currently DISABLED** and there are no issue templates — any
GitHub-native route needs those toggled on first. Natural in-game entry point:
alongside the Credits/Coffee/Settings pages.

Options:
- **A. Prefilled "New Issue" link** — button → `…/issues/new` with a template.
  Zero infra, triaged in-repo, GitHub moderates. But needs a GitHub account
  (casual players won't have one); "most wanted" = manually sort by 👍.
- **B. GitHub Discussions + upvoting** — best GitHub-native answer to "what
  players most want" (native upvotes, top-sorted Ideas). Zero infra; still needs
  a GitHub account. Can embed in-page via giscus.
- **C. Dedicated feedback board** (Featurebase/Canny free tier, or self-hosted
  Fider) — players submit + upvote **without** a GitHub account; owner gets a
  ranked roadmap. Best UX for the goal. Cost: third-party dependency + external
  scripts + player data leaving the site (privacy — likely young audience).
- **D. Simple form** (Tally/Google/Formspree) — dead simple, no account, owner
  owns data. No voting / players can't see each other's ideas → weak for "most
  wanted"; good only for raw collection.
- **E. Serverless → GitHub issue** — in-game form POSTs to a tiny free-tier
  function (Cloudflare Worker / Netlify / Vercel, or a GitHub Action via
  `repository_dispatch`) that opens the issue server-side with a token. Faithful
  "opens an issue in the repo" **without** account friction. Cost: a small
  function + secret management (token can't live in the static client) + spam
  guard (honeypot/rate-limit).

Leaning: **B (Discussions + voting)** for least effort if GitHub-account friction
is acceptable; **C or E** if reaching casual players (no account) matters more.
Split bugs (Issues/template, structured) from ideas (Discussions/board, voting).
Favor no-PII + moderated options given the audience. Enabling Issues/Discussions
is a repo-settings change the owner must make.

