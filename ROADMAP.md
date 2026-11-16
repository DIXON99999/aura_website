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
  live matches (map score + live odds, 60s poll).
- **Model:** `elo-v3` (live since 2026-11-16) = v2 map-Elo + head-to-head, plus
  provisional K (a team's first 10 matches move its rating 2.5× faster).
  Backtest (last 3,674 matches, never used for tuning): **64.2%** (v2 63.0%),
  tier-1 64.1% (v2 62.0%), Brier 0.2226 (v2 0.2243). Registry: `backend/src/predict/model.ts`.
- **Next up:** 4. Correct-prediction moment. **Also:** check live mode against a
  real live match (PGL Major starts Tue 24 Nov, 3 pm AEDT) — so far it has only
  been tested with a simulated live row.

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

### 4. Correct-prediction moment  ⬅ start here
- [ ] When a watched match finishes and the pick was right: card flips to the
      result with a green burst.
- [ ] Streaks in History ("model 7/8 this week").

### 5. Upcoming-match polish
- [ ] Countdown on the next big match only (a full countdown everywhere was
      tried and reverted — the user prefers Melbourne times on cards).
- [ ] "Biggest upset chance" highlight; featured grand-final card.
- [ ] Use PandaScore `opponent.dark_mode_image_url` for team logos (fixes
      all-black logos like Spirit disappearing on the dark cards).

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
- PandaScore free tier: `/csgo/matches/:id` is 403 — use `/matches/:id`.
