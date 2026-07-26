# Backlog: Pending changes, bug fixes, TODOs

Owner: tormarod
Last updated: 2026-07-26

> Running list, tracked in git so collaborators can see it. Not a shipped
> changelog — just a place to park things noticed mid-session that aren't
> worth fixing right now, or that need a decision before they become a plan.
> Add an entry whenever something comes up; move it to `docs/plans/` if it
> grows into an actual multi-phase plan, and **delete the entry here once the
> change ships** (keep this list current — never leave done items listed).

---

## Open items

### Nine alt forms have no official artwork upstream (broken-image icon)

Form sprites are now derived from the id (`officialArtworkSprites()`,
`pokemon-service/official-artwork.ts`), which assumes
`official-artwork/<id>.png` exists in the PokeAPI sprites repo. Checked all 249
form/mega ids against the repo: 7 are missing only the **shiny** artwork
(meowstic-female 10025, zarude-dada 10192, dudunsparce-three-segment 10255,
maushold-family-of-three 10257, terapagos-stellar 10277, garchomp-mega-z 10309,
magearna-original-mega 10318) and 2 are missing **both** (tatsugiri-curly-mega
10322, tatsugiri-droopy-mega 10323). No regression — PokeAPI returned `null` for
exactly those before, so they were blank then too — but they now render a broken
image instead of nothing. Fix if it looks bad: give `EventPopupComponent` (and
the aux-list pick tiles) an `(error)` fallback to a local placeholder, the way
`evolution-line-modal.component.ts` (`onSpriteError`) and the item views
(`ITEM_SPRITE_FALLBACK`) already do.

### Restore gen-9 Area Zero adventure-draw test coverage

Removing Classic mode (4.0.0, `docs/plans/done/remove-classic-mode.md`) deleted
`main-adventure-roulette.component.spec.ts`'s old wheel-path describe block,
which was the only place asserting `areaZero` gets appended to the drawable
pool on generation 9. The reward-pool draw path itself is still covered; only
the gen-9-specific inclusion isn't. Low priority — add a test that spies
`rollStep` → `'reward'`, drives the generation subject to 9, and asserts
`areaZeroCandidate` is present in `component['resolveCandidates'](...)`'s
input pool (or equivalent), if this needs re-verifying.

### PokedexDetailModalComponent Mega-form stats don't update

In the Pokédex browser's detail modal (`pokedex-detail-modal.component.ts`),
selecting a Mega form doesn't update the displayed power. Root cause:
`alternateForms`'s mega-form mapping converts a mega `PokemonItem` to a
`PokemonForm`, but `PokemonForm` has no `power` field to carry it, so
`detailsPower` silently falls back to the base Pokémon's power. Pre-existing,
unrelated to the new evolution-line modal (`evolution-line-modal.component.ts`),
which has its own correct, separate Mega power handling and doesn't touch this
component. Low priority — only affects the Pokédex browser's stat readout for
Mega forms, not battle math.

### Re-evaluate late-game catch value after the endgame rebalance

Once your team is six power-3s, `catchPokemon` (reward-pool weight 5, the biggest)
and `catchTwoPokemon` (w2) taper off — a caught mon goes to PC storage and only
matters if you swap it into the 6-member team (battle odds read only the team).
Deferred, **not** a fix now: the PC bench has real value for per-opponent matchup
swaps (opponent preview + type math), and the 3-pick adventure draw already lets a
player skip an unwanted catch. But that bench value scales with the matchup unit,
so **once `docs/plans/endgame-rebalance.md` Phase 1 (the endgame
matchup-unit doubling) ships, re-check whether late catches still feel stale.** If
they do, options: re-weight the reward pool away from catch once the team is full,
or offer a swap prompt when a caught mon is a genuine upgrade. Decision record:
`docs/plans/endgame-rebalance.md` Q3.

### team-synergy ability rewards mono-type teams (coverage tension)

`synchronize` (`team-synergy`, +value Yes per same-type teammate,
`abilities-data.ts`) pays out most on a mono-type team — which is exactly what the
matchup math punishes against varied opponents. Currently treated as a legitimate
high-risk build choice, **not** a bug (see `endgame-rebalance.md` Phase 2
note). Revisit only if playtest shows a mono-type synergy stack is degenerately
strong (or dead) after the ability-magnitude pass.

### Ability capsules drop fully random (hard to get one that fits)

Capsules are looted/bought at random from all 30, so landing one that synergises
with a specific team's types is unlikely, and assignment is a chore for a small
odds nudge. Possible directions (undecided): a small pick-from-N capsule choice
instead of a single random award, or biasing the capsule draw toward the team's
types. Low priority — revisit after the Phase 2 magnitude pass, which changes how
much a capsule is worth in the first place.

### Sync non-en ability descriptions with en (post ability-dedup)

The ability-effect dedup pass (`docs/plans/done/deduplicate-ability-effects.md`)
rewrote 10 ability descriptions in `en.json` for their new mechanics and dropped
**English placeholders** into `de/es/fr/it/pt` for those 10 (torrent, keen-eye,
overgrow, rough-skin, poison-point, cursed-body, clear-body, sand-rush,
snow-cloak, thick-fat). Two follow-ups for a translation pass: (1) translate
those 10 placeholders into each locale; (2) apply the same **off-by-one numeral
correction** the en pass made to the untouched abilities (blaze, guts, static,
intimidate, multiscale, swarm, sheer-force, comeback, marvel-scale — the shown
magnitude was one less than the real ticket value) in all five translated
locales. Low priority — placeholders are readable English, and the untouched
numerals were already off before this pass.

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
