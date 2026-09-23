# Q-ADR API contract (v1)

Base URL = `VITE_API_URL` (includes `/api/v1`). JSON everywhere. Times in the
simulation are minutes since event start; real endpoints use ISO timestamps.

## Implemented today (`backend/main.py` FastAPI, or `backend/server.py` stdlib)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/health` | – | `{ok, time, qiskit, ibmReady, reason?}` |
| GET | `/scenario` | `id=t0\|t6\|t12` | grid, risk cells `{lng,lat,risk,level}`, candidates `{id,name,lng,lat,region}`, rivers, coast, coverKm, splitLng, uniformPlan |
| POST | `/quantum/solve` | `{scenario, k(2–8), method, p, shots, previous?, local?, backend?}` | `SolveResult`: selection, coverage, ratio, exactCoverage, regions (with params for warm start), timeS |
| GET | `/quantum/benchmark` | `id, k` | uniform / greedy / exact / QAOA-sim comparison |

`method`: `uniform | greedy | exact | qaoa_sim | qaoa_ibm` (IBM needs `QISKIT_IBM_TOKEN` and qiskit installed; returns 503 otherwise).

## To build next (the frontend already does these in-browser in demo mode)

Logic to port from `frontend/disfront/src/store/world.ts`; tables in `supabase/migrations/001_init.sql`.

| Method | Path | Purpose | Port from |
|---|---|---|---|
| POST | `/reports` | citizen / field report → trust score → open, merge (≤1.2 km) or hold | `fileReport`, `trustOf` |
| GET | `/reports?mine=1` | a reporter's own reports with live status | CitizenApp "my reports" |
| POST | `/reports/{id}/release` | command releases a held report | Reports page |
| POST | `/dispatch/replan` | greedy dispatch with switching cost, MAX_ETA 180 → plan changes + approvals | `replan` |
| POST | `/units/{id}/status` | `on_scene \| resolved \| offline \| available \| backup` | `fieldUpdate` |
| POST | `/closures` | road blocked → re-route affected units | `blockRoad` |
| POST | `/approvals/{id}` | `{decision: approve\|decline}` | `decide` |
| POST | `/alerts` | send EN/TE alert to area + channels | `sendAlert` |
| GET | `/routes` | server-side Mapbox Directions with `exclude=point(...)` for closures (keeps the secret token off the client) | `lib/routing.ts` |
| GET | `/feeds/river` | cached Open-Meteo Flood + Forecast | Feeds page |

Writes go through the backend with the Supabase **service** key; the browser reads
live state straight from Supabase Realtime (`units`, `incidents`, `closures`,
`approvals`, `alerts`, `shelters`) with the anon key and RLS.

Trust score (keep identical to the frontend):
`raw = (0.22·source + 0.18·history + 0.18·location + 0.22·corroboration + 0.10·evidence) / 0.9`,
`trust = raw · (1 − 0.7·anomaly)`; confirm ≥ 0.72, official ≥ 0.55, life-safety floor 0.35.
