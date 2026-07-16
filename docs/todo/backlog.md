# Backlog: Pending changes, bug fixes, TODOs

Owner: tormarod
Last updated: 2026-07-16

> Running list, tracked in git so collaborators can see it. Not a shipped
> changelog — just a place to park things noticed mid-session that aren't
> worth fixing right now, or that need a decision before they become a plan.
> Add an entry whenever something comes up; move it to `docs/plans/` if it
> grows into an actual multi-phase plan, and **delete the entry here once the
> change ships** (keep this list current — never leave done items listed).

---

## Open items

### Type-bias items should stack when multiple are used

Using multiple soft-bias items of the same kind should **compound** the effect
rather than be redundant. E.g. **2 Honey used → 2× the bias** toward the chosen
type; **2 Repel → 2× the bias** away from it. Today a used bias effectively just
sets a pending toward/away entry, so a second use of the same kind is redundant
(or overwrites) instead of stacking.

Scope / open questions (decide before it becomes a plan):
- Applies to the **soft-bias** items (Honey = toward, Repel = away), which feed
  the type-weighting on the catch/trade/obtain wheels. The **hard-guarantee**
  items (Poké Radar, Max Repel) probably should NOT stack — a guarantee is
  already absolute.
- Define what "2×" means concretely against the current bias math (examine how
  `setTowardBias` / `setAwayBias` weight the wheels in `TrainerService` +
  `select-from-type-list` / catch flow). Linear per stack (n items → n× weight)?
  Capped?
- UI: the bias indicator(s) next to the Items panel should show the stacked
  strength (e.g. "×2").

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
