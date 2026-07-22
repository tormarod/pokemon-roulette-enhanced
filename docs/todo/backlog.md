# Backlog: Pending changes, bug fixes, TODOs

Owner: tormarod
Last updated: 2026-07-22

> Running list, tracked in git so collaborators can see it. Not a shipped
> changelog — just a place to park things noticed mid-session that aren't
> worth fixing right now, or that need a decision before they become a plan.
> Add an entry whenever something comes up; move it to `docs/plans/` if it
> grows into an actual multi-phase plan, and **delete the entry here once the
> change ships** (keep this list current — never leave done items listed).

---

## Open items

### Re-evaluate late-game catch value after the endgame rebalance

Once your team is six power-3s, `catchPokemon` (reward-pool weight 5, the biggest)
and `catchTwoPokemon` (w2) taper off — a caught mon goes to PC storage and only
matters if you swap it into the 6-member team (battle odds read only the team).
Deferred, **not** a fix now: the PC bench has real value for per-opponent matchup
swaps (opponent preview + type math), and the 3-pick adventure draw already lets a
player skip an unwanted catch. But that bench value scales with the matchup unit,
so **once `docs/plans/game-design-holistic-review.md` Phase 1 (the endgame
matchup-unit doubling) ships, re-check whether late catches still feel stale.** If
they do, options: re-weight the reward pool away from catch once the team is full,
or offer a swap prompt when a caught mon is a genuine upgrade. Decision record:
`docs/plans/game-design-holistic-review.md` Q3.

### team-synergy ability rewards mono-type teams (coverage tension)

`synchronize` (`team-synergy`, +value Yes per same-type teammate,
`abilities-data.ts`) pays out most on a mono-type team — which is exactly what the
matchup math punishes against varied opponents. Currently treated as a legitimate
high-risk build choice, **not** a bug (see `game-design-holistic-review.md` Phase 2
note). Revisit only if playtest shows a mono-type synergy stack is degenerately
strong (or dead) after the ability-magnitude pass.

### Ability capsules drop fully random (hard to get one that fits)

Capsules are looted/bought at random from all 30, so landing one that synergises
with a specific team's types is unlikely, and assignment is a chore for a small
odds nudge. Possible directions (undecided): a small pick-from-N capsule choice
instead of a single random award, or biasing the capsule draw toward the team's
types. Low priority — revisit after the Phase 2 magnitude pass, which changes how
much a capsule is worth in the first place.

### Shiny animation could default to skipped

Shiny is 1/64 and purely cosmetic (no power effect), but the reveal animation
plays on every catch unless `skipShinyRolls` is set — 20–30 interruptions per run
for zero mechanical stake. Consider making skip the default and the animation the
opt-in. Minor QoL; owner call on default.

### Scouting Report selection rule may need tuning

Currently pure random among the counters to the ace's type. Consider upgrading
to harmful-random (filter out counters that don't worsen the team's odds) or
meanest-counter if pure random feels too swingy in playtest. See
`docs/plans/done/threat-mechanics-expansion.md` (Phase 3) for the current
implementation and the decision record.

### Bench-to-win emergent property (possible balance topic)

Fielding fewer than 6 Pokémon to shed a matchup liability raises win % when
the team is already favored — an emergent property of the odds math, not
something PC Lockout introduced, but PC Lockout's freeze makes the tradeoff
more visible. Independent balance topic, not yet decided whether it needs a
fix.

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
