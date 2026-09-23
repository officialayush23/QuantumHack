# Q-ADR demo console

React + shadcn/ui front end (`frontend/disfront`) with an optional Python backend (`backend`).
By default the console runs on **recorded results** (`public/snapshot.json`): real QAOA runs from
the backend's statevector simulator for T0, T+6 h and T+12 h at k = 6. No server is needed for the
video or the hosted link.

## 1. Add the shadcn components (once)

```bash
cd frontend/disfront
npx shadcn@latest add alert badge card chart label popover progress scroll-area select separator skeleton slider switch table tabs toggle-group tooltip
```

`button` is already in the project. `chart` also installs `recharts`.

## 2. Run

```bash
npm run dev          # http://localhost:5173, recorded results
```

Optional live backend (any k, re-solves for real):

```bash
cd backend && pip install -r requirements.txt && python server.py
# then in frontend/disfront/.env.local:
VITE_API_URL=http://localhost:8000
```

## 3. What is on screen

| Area | What it shows |
|---|---|
| Header badges | Recorded results vs live API; whether an IBM Quantum account is configured |
| **Guide** button | Step-by-step coach marks over every panel (opens automatically on first visit) |
| Scenario toggle | T0 forecast → T+6 h Budameru surge → T+12 h delta flooding |
| **Run full simulation** | Plays all three steps: the risk layer morphs, the pipeline runs, QAOA samples flash on the map, units glide to their new sites |
| Map | Risk cells, numbered response units with coverage radius, pulsing rings = bitstrings being sampled, dashed rings = sites vacated |
| Solver card | Method, k, p, shots, adaptive switches, live pipeline stages |
| Metric cards | Coverage, approximation ratio vs exact search, feasible samples, cost evaluations |
| Tabs | QAOA internals (convergence replay, sampled bitstrings, QUBO matrix), plan with New / Kept / Withdrawn, benchmark vs baselines, event log |

## 4. Suggested video flow (about 2 minutes)

1. Open the console, click **Guide**, step through 3–4 coach marks.
2. Click **Run full simulation** and let it play: talk over the caption bar at each step
   (cold solve at T0, warm start at T+6 h: 150 vs 2,400 cost evaluations, units moving downstream at T+12 h).
3. Open **QAOA internals**: point at feasible samples vs random, "Hit QUBO optimum", the QUBO matrix.
4. Open **Benchmark**, click **Run benchmark**: uniform vs greedy vs exact vs QAOA.
5. Close on the footer line: simulator results, prototype risk layer, no quantum-advantage claim.

## 5. Deploy the front end (static)

Vercel or Netlify, no environment variables needed:

- Root directory: `frontend/disfront`
- Build command: `npm run build`
- Output directory: `dist`

The recorded results ship inside `dist/snapshot.json`, so the hosted link works without the backend.

## 6. Refresh the recorded results

```bash
cd backend
python make_snapshot.py ../frontend/disfront/public/snapshot.json
```

For real IBM hardware numbers use `benchmark/run_ibm.py` (see `benchmark/README.md`) or run the backend
with a saved IBM Quantum account and pick "QAOA · IBM Heron QPU".
