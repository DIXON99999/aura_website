# CSOdds roadmap

CS2 match-prediction site. Living document: update **Status** and tick items off
as work lands, so any session (human or Claude) can pick up where we left off.

_Last updated: 2026-11-16_

## Status

- **Branch:** `prediction-site` (pushed, CI green). Not merged to `main` yet.
- **Live features:** Matches tab (Tier 1 / Other, List / Calendar, tier-1 events
  incl. TBD matches), History tab (final scores, pre-match pick bar, green/red
  for correct/wrong), Accuracy tab, organizer corner tabs (BLAST/ESL/PGL/…),
  playoff stage badges, all times in Melbourne time, match detail pages,
  live matches (map score + live odds, 60s poll), bracket pages with an
  animated replay of the latest results.
- **Model:** `elo-v3` (live since 2026-11-16) = v2 map-Elo + head-to-head, plus
  provisional K (a team's first 10 matches move its rating 2.5× faster).
  Backtest (last 3,674 matches, never used for tuning): **64.2%** (v2 63.0%),
  tier-1 64.1% (v2 62.0%), Brier 0.2226 (v2 0.2243). Registry: `backend/src/predict/model.ts`.
- **Next up:** nothing queued — options: predictor v4 ideas (see step 1, e.g. forfeits in H2H), a map
  data source (Later), merging `prediction-site` → `main` via PR.
  **Also:** check live mode and the finish animation against a
  real live match (PGL Major starts Tue 24 Nov, 3 pm AEDT) — so far both have
  only been tested with a simulated live row; same day, check the Swiss grid
  replay with real results.

## Up next (in order)

### 1. Predictor v3 — more parameters  ✅ done (2026-11-16)
- [x] Backtest harness: `bun src/predict/backtest.ts` (walk-forward, warm-up 50% /
      tune 25% / confirm 25%, log-loss + Brier + accuracy, tier-1 slice). History
      cache: `bun --env-file=.env src/predict/history.ts` → `backend/data/history.json`.
- [x] Configurable model (`ModelConfig` in `elo.ts`; `V2_CONFIG` pinned by a regression test).
- [x] Tried: tier-weighted K, provisional K, inactivity shrink, LAN rating,
      rating scale, base K, H2H weight. **Kept only provisional K** (×2.5 for the
      first 10 matches). Inactivity shrink made things worse; LAN rating helped
      tier-1 only in one window (inconsistent); H2H 0.4 hurt tier-1.
      Add a parameter only if it cuts TUNE log-loss by ≥ 0.001.
- [x] Accuracy page: backtest model comparison + live results per model version.
- **Map-aware model is blocked:** PandaScore's free tier has no map names
  (`games[].map` is null everywhere; `/csgo/*` detail is 403). See Later.
- Ideas for v4 (need the backtest to prove them): LAN rating with more LAN
  data, region strength offsets (`tournament.region` vs `opponent.location`),
  series-score margin, **excluding forfeits from head-to-head** (`recordH2H`
  counts them — ~9% of matches are forfeits; ratings already skip them).

### 2. Match detail page  ✅ done (2026-11-16)
- [x] `/match/:id` from any Matches / History card (overlay `CardLink`; calendar
      day list cards too): hero, "why this prediction" (ratings → one map →
      best-of → head-to-head → final, built by `logic.explainPrediction` so it
      always equals the live model), rating trend chart, recent form, head-to-head.
- [x] `match_log` table: every match the backfill replays (incl. forfeits,
      flagged) with post-match ratings; light refresh appends new results.
- Per-map win rates dropped — no map data on the free tier.
- Note: head-to-head can *lower* a favourite who leads the record (the blend
  pulls toward the shrunk H2H rate); the page says "pulls toward X%" for that reason.

### 3. Live matches  ✅ done (2026-11-16)
- [x] `pollLive` every 60s (`/csgo/matches/running`): predicted matches in
      progress get `status='live'`, map score, per-map status, live odds; the
      30m refresh never overwrites a live row. A match that leaves the running
      feed is settled straight away (one early attempt; the 30m settle backs it up).
- [x] Live odds = series probability from the current map score, starting from
      the exact pre-match number (`impliedMapProb` → `seriesProbGivenScore` in
      `logic.ts`). E.g. 57% favourite who takes map 1 of a BO3 → 79%.
- [x] UI: LIVE badge, map score + map pips, live % with "was X%", live cards
      first, 30s auto-refresh (paused in hidden tabs), calendar chip, match page.
- Free tier has no round scores, so odds move between maps only.
- ⚠ Only tested with a simulated live row (scratchpad `simlive.ts`) — verify
  against a real live match.

### 4. Correct-prediction moment  ✅ done (2026-11-16)
- [x] A live match that ends while Matches is open moves to "Just finished":
      the card flips (CSS 3D) from the last live view to the result — green
      burst + ring + "Model called it" if right, red tint + shake + "Upset" if
      not. Stays 10 min or until dismissed. Same flip on the match page.
      Reduced-motion users get the result without animation.
- [x] History: "This week" record and current run (`streaks.ts`, tested;
      respects the tier filter). Note: until live predictions accumulate these
      include replay picks.
- E2E check script (scratchpad `celebrate.ts`): drives Chrome via DevTools,
      settles a simulated live match mid-session, screenshots the flip.

### 5. Upcoming-match polish  ✅ done (2026-11-16)
- [x] Featured card at the top of the list view: the next grand final if one is
      scheduled (gold ring), else the next match — the only place with a
      countdown (a countdown everywhere was tried and reverted; the user
      prefers Melbourne times on cards).
- [x] Upset watch: among matches with a clear favourite (≥ 60%), the underdog
      with the best chance (`spotlight.ts`, tested).
- [x] Dark-mode team logos (`logic.teamLogo` prefers `dark_mode_image_url`;
      63 of ~220 teams have one, incl. Spirit, NIP, FaZe, 100 Thieves).
- Gotcha: `Featured.tsx` + `featured.ts` clash on Windows (case-insensitive) —
  logic module is `spotlight.ts`.

### 6. Bracket visualiser  ✅ done (2026-11-16)
- [x] `event_stages` table: every stage (PandaScore tournament) of running,
      upcoming and last-14-day tier-1 events with all matches + `previous_matches`
      links (`refreshBrackets` in the 30m refresh; finished stages aren't
      re-fetched; a match that ends in `pollLive` re-fetches its stage at once).
- [x] API: `/events/:serieId/bracket` (stages + model % per match),
      `/brackets` (event list), `/match/:id` returns `bracket` for the link.
- [x] `/event/:serieId?stage=` page (`Bracket.tsx`): stage tabs; bracket stages
      laid out from the link graph (`bracketGraph.ts`, tested): upper / lower rows,
      grand final, 3rd-place match, seeded slots, Champion / Advances slots, SVG
      connectors (green once filled), ✓ called / ✗ upset per match, model % on
      unplayed ones. Stages without a bracket (Major Swiss) show a record grid
      (0–0 → 3–x), plus the matches still to play.
- [x] Replay on open: first visit (and the Replay button) = the whole stage
      from round 1, a round at a time (`batchMoves`: all QF scores land, then
      all QF winners fly together, …); later visits = only results since your
      last visit to that stage (localStorage). Score lands → winner chip
      flies (WAAPI clone) to its next slot / Champion, loser drops to the lower
      bracket or fades. Skip / Replay buttons; new results while open animate
      too; reduced motion shows the final state. Phone: bracket scrolls inside
      its own box and follows the flying chip.
- Links: event cards (Matches), "View bracket" on match pages, "Brackets" chips on History.
- Verified (headless Chrome, scratchpad `brshot.ts`): BLAST Rivals playoffs,
  IEM Beijing double-elim groups + playoffs, PGL Major Stage 1 (Swiss, not started).
  ⚠ Check a Swiss stage with results once the Major starts (24 Nov).

### Later / parked
- **Map-aware model** (per-map team ratings, re-price on veto). Needs a map data
  source: (a) Liquipedia MediaWiki API — free, match pages list maps, but needs
  parsing + polite rate limits; or (b) PandaScore paid tier (games include maps).
  `captureMaps` in ingest is in place but has captured 0 maps on the free tier.
- Player-level stats & roster changes — would help the model a lot, but needs
  PandaScore's paid tier.
- Remove the legacy Aura app (old routes/pages; its `initTables` still runs on
  backend start) and then enforce lint in CI (~540 of the ~550 lint errors are
  legacy code).
- Proper DB migrations instead of runtime `CREATE/ALTER` in `ingest.ts`.

## Done

- 2026-11-16 — Bracket visualiser: `event_stages`, bracket + Swiss layouts,
  replay animation of the latest results. 175 tests.
- 2026-11-16 — Upcoming-match polish: featured match + countdown, upset watch,
  dark-mode logos. 149 tests.
- 2026-11-16 — Correct-prediction moment (flip + burst) and History streaks. 140 tests.
- 2026-11-16 — Live matches: 60s poller, live odds from map score, LIVE UI. 134 tests.
- 2026-11-16 — Match detail page + `match_log`. Fixed: backfill applied a match
  twice when paging overlapped (now de-duplicated by id). 123 tests.
- 2026-11-16 — Predictor v3 (`elo-v3`): backtest harness, configurable model,
  provisional K; Accuracy page model comparison. 110 tests.
- 2026-11-16 — Unit tests (86, `bun test`) + GitHub Actions CI (typecheck, tests,
  build). Pure logic extracted to `backend/src/predict/logic.ts`.
- 2026-11-16 — Tier-1 events + TBD matches, calendar view, stage badges,
  Melbourne time, history cards redesign.
- 2026-11-16 — History tab with walk-forward replay picks; tier filters;
  organizer branding; fixed live predictions being deleted before settlement.
- 2026-11-13 — Pivot from Aura leaderboards to CSOdds (Elo model, ingest,
  scheduler, Upcoming / Rankings / Accuracy pages).

## Decisions & gotchas

- **Tier 1** = PandaScore `tournament.tier` in (`s`, `a`). `serie.tier` is always null.
- **History picks** for matches before 2026-11-16 are *replays* (model re-run with
  only pre-match data), because the old refresh deleted the live predictions.
  The API returns `pickSource: 'live' | 'replay'`; the UI no longer labels it —
  add a note before going public.
- **Table names:** prediction tables are `predictions`, `team_ratings`, `h2h`,
  `results`, `tier1_events`. Don't use `events` — the legacy app owns it.
- **Times:** always via `src/predict/time.ts` (Australia/Melbourne, DST-aware).
- **Organizer logos** live in `public/orgs/` (from Liquipedia); themes are the
  `ORGS` list in `src/predict/ui.tsx`.
- **Windows + Vite:** HMR occasionally serves a stale module after an edit
  (blank page, "does not provide an export named …"). Restart Vite.
- Same clash for brackets: page is `Bracket.tsx`, logic is `bracketGraph.ts`.
- Scratchpad CDP scripts from Git Bash: `export MSYS_NO_PATHCONV=1` first, or
  `/event/…` arguments get rewritten into Windows paths.
- PandaScore free tier: `/csgo/matches/:id` is 403 — use `/matches/:id`.
