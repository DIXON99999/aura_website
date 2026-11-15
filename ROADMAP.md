# CSOdds roadmap

CS2 match-prediction site. Living document: update **Status** and tick items off
as work lands, so any session (human or Claude) can pick up where we left off.

_Last updated: 2026-11-16_

## Status

- **Branch:** `prediction-site` (pushed, CI green). Not merged to `main` yet.
- **Live features:** Matches tab (Tier 1 / Other, List / Calendar, tier-1 events
  incl. TBD matches), History tab (final scores, pre-match pick bar, green/red
  for correct/wrong), Accuracy tab, organizer corner tabs (BLAST/ESL/PGL/…),
  playoff stage badges, all times in Melbourne time.
- **Model:** `map-elo-h2h-v2` — one map-Elo rating per team + head-to-head blend.
  ~62.5% on held-out matches (backtest); History replay shows ~63% on tier 1.
- **Next up:** 1. Predictor v3 (map-aware) — see below.

## Up next (in order)

### 1. Predictor v3 — map-aware model  ⬅ start here
Biggest lever on the site's core value. The current model ignores which maps
are played.
- [ ] Per-map team ratings (start from `aura-platform/ml/map_elo.py` experiment).
- [ ] Predict each map of the series → series odds; before veto, use each
      team's map pool / pick tendencies.
- [ ] Re-price when the veto lands (`captureMaps` in `backend/src/predict/ingest.ts`
      already stores played maps on `predictions.maps`).
- [ ] Candidate extra features (keep only what backtests better): LAN vs online,
      event importance (tier / stage), recency weighting.
      _Note: a fast "form" Elo was tried and worsened calibration — FORM_WEIGHT=0._
- [ ] Evaluate with Brier score / log-loss, not just accuracy; show model
      version comparison on the Accuracy page.

### 2. Match detail page
- [ ] Click a card → recent form, H2H history, per-map win rates, "why this
      prediction" (rating gap, H2H, map edge).

### 3. Live matches
- [ ] LIVE state on cards with current map score (PandaScore per-game results).
- [ ] Odds that update between maps.

### 4. Correct-prediction moment
- [ ] When a watched match finishes and the pick was right: card flips to the
      result with a green burst.
- [ ] Streaks in History ("model 7/8 this week").

### 5. Upcoming-match polish
- [ ] Countdown on the next big match only (a full countdown everywhere was
      tried and reverted — the user prefers Melbourne times on cards).
- [ ] "Biggest upset chance" highlight; featured grand-final card.

### Later / parked
- Player-level stats & roster changes — would help the model a lot, but needs
  PandaScore's paid tier.
- Remove the legacy Aura app (old routes/pages; its `initTables` still runs on
  backend start) and then enforce lint in CI (~540 of the ~550 lint errors are
  legacy code).
- Proper DB migrations instead of runtime `CREATE/ALTER` in `ingest.ts`.

## Done

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
