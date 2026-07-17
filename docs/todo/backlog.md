# Backlog: Pending changes, bug fixes, TODOs

Owner: tormarod
Last updated: 2026-07-17

> Running list, tracked in git so collaborators can see it. Not a shipped
> changelog — just a place to park things noticed mid-session that aren't
> worth fixing right now, or that need a decision before they become a plan.
> Add an entry whenever something comes up; move it to `docs/plans/` if it
> grows into an actual multi-phase plan, and **delete the entry here once the
> change ships** (keep this list current — never leave done items listed).

---

## Open items

### Playtest the new symmetric type-matchup scoring for balance/feel

`TypeMatchupService` was reworked (see `docs/plans/done/type-matchup-symmetric-scoring.md`)
from best-case-offense/worst-case-defense tiers to a fully symmetric per-type net score.
This is a real difficulty rebalance: ~30 of the game's 51 super-effective type pairs are
"mutual" (also resisted-by/immune-to on the counter-hit), and those matchups are now
meaningfully harsher/stronger than before on both sides. Worth a few playthrough rounds
across different starters/generations to check the feel isn't too swingy before considering
it fully settled.

### Minor: NG0100 dev-mode warning on the gym-trio/duo async path

Found while investigating the item above, not fixed (doesn't affect production
or cause a blank screen — it's a dev-only Angular diagnostic). In
`gym-battle-roulette.component.ts`'s `getCurrentLeader()`, the async
`translate.get(...)` rebuild for trio/duo gym leaders (gen 5/7/8 special
rounds) calls `this.fromLeaderChange.emit(randomIndex)`, mutating a two-way-bound
`@Input` after the current change-detection cycle has already checked it —
`ExpressionChangedAfterItHasBeenCheckedError`. Fix would be deferring the
emit/reassignment (e.g. a microtask) so it lands in a fresh CD cycle.

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
