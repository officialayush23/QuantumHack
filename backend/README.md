# Q-ADR backend

Standard-library HTTP server + NumPy/SciPy. No web framework needed.

```bash
cd backend
pip install -r requirements.txt
python server.py                      # http://localhost:8000
```

| endpoint | purpose |
|---|---|
| `GET /api/health` | solver status, whether Qiskit + an IBM Quantum account are available |
| `GET /api/scenario?id=t0\|t6\|t12` | grid, risk cells, candidate sites, rivers for T0 / T+6 h / T+12 h |
| `POST /api/solve` | `{scenario, k, method, p, shots, local, previous}` → placement, coverage, ratio vs exact, per-subproblem QAOA details |
| `GET /api/benchmark?id=t0&k=6` | uniform vs greedy vs exact vs QAOA (simulator) |

`method`: `uniform`, `greedy`, `exact`, `qaoa_sim`, `qaoa_ibm`.

Adaptive re-planning: pass the previous response's `regions` as `previous`. Regions whose risk mass
changed by less than 10% are reused (no quantum call); the others are warm-started from the
previous QAOA angles (150 cost evaluations instead of 2,400 cold).

IBM hardware: `pip install qiskit qiskit-ibm-runtime`, save your account once with
`QiskitRuntimeService.save_account(channel="ibm_quantum_platform", token=..., instance=..., set_as_default=True)`,
restart the server, and "QAOA · IBM Heron QPU" becomes selectable in the UI.

Regenerate the frontend's offline snapshot after changing the model:
`python make_snapshot.py ../frontend/disfront/public/snapshot.json`
