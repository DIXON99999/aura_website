# CSOdds (CS2 match predictions)

**Start every session by reading `ROADMAP.md`** — it has the current status,
the ordered next steps, and known gotchas. Update its Status / checkboxes /
Done list whenever a piece of work lands.

## Layout
- `aura-platform/` — Vite + React 19 + Tailwind frontend (`src/predict/` is the
  live site; `src/pages/`, `src/components/` are the legacy Aura app).
- `aura-platform/backend/` — Bun + Hono API on :3001, Postgres.
  Prediction code: `src/predict/` (`elo.ts` model, `logic.ts` pure decisions,
  `ingest.ts` PandaScore → DB, `scheduler.ts`), routes in `src/routes/predictions.ts`.
- `aura-platform/ml/` — Python model experiments.

## Run
- Backend: `cd aura-platform/backend && bun --watch src/index.ts`
  (needs `.env`: `DATABASE_URL`, `PANDASCORE_TOKEN`; scheduler refreshes every 30m).
- Frontend: `cd aura-platform && npx vite` → http://localhost:5173
- Full rebuild of ratings/history: `cd aura-platform/backend && bun --env-file=.env src/predict/ingest.ts`

## Check before committing
- `cd aura-platform && npm run check` (typecheck frontend + tests + backend, then `bun test`).
- CI (`.github/workflows/ci.yml`) runs the same plus `vite build` on every push.
- Put new decision logic in pure modules (`logic.ts`, `stage.ts`, `time.ts`) with tests.
