# QADR benchmark

Placement of k = 6 response units on the Krishna / Vijayawada grid instance
(285 cells, 23 candidate sites, 100,947 possible plans).

| file | what it does |
|---|---|
| `model.py` | grid, prototype risk layer, candidate sites, greedy baseline |
| `qadr_bench.py` | uniform vs greedy vs exact search vs QAOA (p = 2, ideal statevector, NumPy). Writes `results.json` |
| `run_ibm.py` | runs the same two QAOA subproblems (12 + 11 qubits) on an IBM Heron QPU with Qiskit Runtime Sampler V2 |

```bash
pip install numpy scipy
python qadr_bench.py                     # ~10 s, numbers used on slide 12

pip install "qiskit>=2.0" "qiskit-ibm-runtime>=0.40"
python run_ibm.py --fake                 # local noisy dry run (needs qiskit-aer)
python run_ibm.py                        # real hardware, least-busy backend
```

`run_ibm.py` transfers the simulator-optimised angles to hardware and samples once per
subproblem (4,096 shots, dynamical decoupling + gate twirling), so it uses well under the
Open Plan's monthly QPU allowance. It writes `results_ibm.json` with the job IDs, transpiled
two-qubit gate counts, feasible-sample share, coverage and approximation ratio.
