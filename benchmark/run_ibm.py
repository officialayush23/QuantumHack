"""Run the two QAOA subproblems from qadr_bench.py on IBM Quantum hardware.

Setup (once):
    pip install "qiskit>=2.0" "qiskit-ibm-runtime>=0.40" numpy scipy
    python -c "from qiskit_ibm_runtime import QiskitRuntimeService as S; S.save_account(channel='ibm_quantum_platform', token='<API key>', instance='<CRN>', set_as_default=True)"

Usage:
    python run_ibm.py                  # least-busy real IBM backend (Open Plan works: batch mode)
    python run_ibm.py --backend ibm_fez
    python run_ibm.py --fake           # local noisy test with FakeFez (needs qiskit-aer)

Strategy (keeps QPU time small, fits the free 10 min/month):
    angles are optimised classically on the ideal simulator (qadr_bench.py), then transferred
    to hardware and sampled once per subproblem with 4,096 shots, DD + gate twirling on.
Writes results_ibm.json with job IDs, transpiled 2-qubit gate counts, feasibility and coverage.
"""
import argparse, json
import numpy as np
from qiskit.circuit.library import QAOAAnsatz
from qiskit.quantum_info import SparsePauliOp
from qiskit.transpiler import generate_preset_pass_manager
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler, Batch

import qadr_bench as qb


def ising(Q):
    """x^T Q x with x = (1 - z)/2  ->  sum h_i Z_i + sum_{i<j} J_ij Z_i Z_j (+ const, dropped)."""
    n = Q.shape[0]
    terms = []
    for i in range(n):
        h = -Q[i, i] / 2 - sum(Q[i, j] for j in range(n) if j != i) / 2
        terms.append(("Z", [i], h))
        for j in range(i + 1, n):
            if Q[i, j] != 0:
                terms.append(("ZZ", [i, j], Q[i, j] / 2))
    return SparsePauliOp.from_sparse_list(terms, num_qubits=n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend")
    ap.add_argument("--fake", action="store_true")
    a = ap.parse_args()

    print("Optimising angles on the ideal simulator ...")
    sim = qb.main()

    if a.fake:
        from qiskit_ibm_runtime.fake_provider import FakeFez
        backend = FakeFez()
    else:
        service = QiskitRuntimeService()
        backend = service.backend(a.backend) if a.backend else service.least_busy(operational=True, simulator=False, min_num_qubits=20)
    print("Backend:", backend.name)

    pm = generate_preset_pass_manager(optimization_level=3, backend=backend)
    pubs, meta = [], []
    for name, (idx, k) in qb.regions().items():
        Q, const, e, xs, scale = qb.subproblem(idx, k)
        s = sim["qaoa_sim"][name]
        ans = QAOAAnsatz(ising(Q), reps=qb.P)
        ans.measure_all()
        isa = pm.run(ans)
        # our NumPy convention: exp(-i gamma E/scale); Qiskit: exp(-i gamma' H) with H = E - const  =>  gamma' = gamma/scale
        def value(p):
            name, i = p.vector.name.lower(), p.index
            if name.startswith(("β", "b")):
                return s["betas"][i]
            return s["gammas_normalised"][i] / scale
        pubs.append((isa, [value(p) for p in isa.parameters]))
        ops = isa.count_ops()
        meta.append({"name": name, "idx": idx, "k": k, "e": e, "xs": xs,
                     "two_qubit_gates": int(sum(v for g, v in ops.items() if g in ("cz", "ecr", "cx"))),
                     "depth": isa.depth()})
        print(f"{name}: {len(idx)} qubits, transpiled 2q gates={meta[-1]['two_qubit_gates']}, depth={meta[-1]['depth']}")

    if a.fake:
        sampler = Sampler(mode=backend)
        job = sampler.run(pubs, shots=qb.SHOTS)
        jobs = [job]
    else:
        with Batch(backend=backend) as batch:
            sampler = Sampler(mode=batch)
            sampler.options.dynamical_decoupling.enable = True
            sampler.options.twirling.enable_gates = True
            job = sampler.run(pubs, shots=qb.SHOTS)
            jobs = [job]
    result = job.result()

    out = {"backend": backend.name, "job_ids": [j.job_id() for j in jobs], "subproblems": {}}
    sel_all = []
    for m, pub in zip(meta, result):
        counts = pub.data.meas.get_counts()
        n = len(m["idx"])
        samples = np.concatenate([np.full(c, int(b, 2)) for b, c in counts.items()])  # key is q_{n-1}..q_0
        feas, best, sel = qb.decode(samples, m["e"], m["xs"], m["idx"], m["k"])
        sel_all += sel
        out["subproblems"][m["name"]] = {"qubits": n, "two_qubit_gates": m["two_qubit_gates"], "depth": m["depth"],
                                         "feasible_frac": float(feas.mean()), "sel": sel}
    out["sel"] = sel_all
    out["cov"] = qb.coverage(sel_all) / qb.TOTAL
    out["ratio"] = out["cov"] / sim["exact"]["cov"]
    try:
        out["qpu_seconds"] = job.usage()
    except Exception:
        pass
    json.dump(out, open("results_ibm.json", "w"), indent=1, default=str)
    print(json.dumps({k: v for k, v in out.items()}, indent=1, default=str))


if __name__ == "__main__":
    main()
