"""Placement solvers on the prototype grid: uniform, greedy, exact, QAOA (NumPy statevector) and
QAOA on IBM hardware (optional, needs qiskit + qiskit-ibm-runtime and a saved account)."""
import itertools, math, time
from functools import lru_cache
import numpy as np
from scipy.optimize import minimize

from . import geo

CVAR_ALPHA = 0.2


# ------------------------------------------------------------------ objective
@lru_cache(maxsize=8)
def weights(scenario):
    return {c: max(0.0, geo.risk(*c, scenario) - 0.3) ** 1.5 for c in geo.CELLS}


def coverage(sel, scenario):
    w = weights(scenario)
    cov = set().union(*[geo.COVERS[i] for i in sel]) if sel else set()
    return sum(w[c] for c in cov) / sum(w.values())


def region_mass(scenario, region):
    w = weights(scenario)
    ids = geo.REGIONS[region]
    return sum(w[c] for c in set().union(*[geo.COVERS[i] for i in ids]))


def split_k(scenario, k):
    mw, me = region_mass(scenario, "west"), region_mass(scenario, "east")
    kw = min(max(1, round(k * mw / (mw + me))), k - 1)
    return {"west": kw, "east": k - kw}


# ------------------------------------------------------------------ classical baselines
def solve_uniform(scenario, k):
    sel = geo.UNIFORM_PLAN[:k]
    return {"selection": sel, "coverage": coverage(sel, scenario)}


def solve_greedy(scenario, k):
    t = time.perf_counter()
    w = weights(scenario); chosen, covered = [], set()
    for _ in range(k):
        best, bi = -1.0, None
        for i in range(len(geo.CANDIDATES)):
            if i in chosen:
                continue
            g = sum(w[c] for c in geo.COVERS[i] if c not in covered)
            if g > best:
                best, bi = g, i
        chosen.append(bi); covered |= geo.COVERS[bi]
    return {"selection": chosen, "coverage": coverage(chosen, scenario), "timeS": time.perf_counter() - t}


@lru_cache(maxsize=32)
def solve_exact(scenario, k):
    t = time.perf_counter(); best, bsel, n = -1.0, None, 0
    for comb in itertools.combinations(range(len(geo.CANDIDATES)), k):
        n += 1
        v = coverage(comb, scenario)
        if v > best:
            best, bsel = v, comb
    return {"selection": list(bsel), "coverage": best, "timeS": time.perf_counter() - t, "plansEvaluated": n}


# ------------------------------------------------------------------ QUBO
def build_qubo(scenario, idx, k):
    """f(x) = -sum w_i x_i + sum_{i<j} o_ij x_i x_j + lam (sum x_i - k)^2  ==  x^T Q x + const."""
    w = weights(scenario); n = len(idx)
    wi = np.array([sum(w[c] for c in geo.COVERS[i]) for i in idx])
    lam = 0.6 * float(wi.max())
    Q = np.zeros((n, n))
    for a in range(n):
        Q[a, a] = -wi[a] + lam * (1 - 2 * k)
        for b in range(a + 1, n):
            ov = sum(w[c] for c in geo.COVERS[idx[a]] & geo.COVERS[idx[b]])
            Q[a, b] = Q[b, a] = (ov + 2 * lam) / 2
    return Q, lam * k * k, lam


def all_energies(Q, const):
    n = Q.shape[0]
    xs = ((np.arange(2 ** n)[:, None] >> np.arange(n)[None, :]) & 1).astype(float)  # bit j = qubit j
    return np.einsum("si,ij,sj->s", xs, Q, xs) + const, xs


def qaoa_state(params, e, n):
    p = len(params) // 2
    psi = np.full(2 ** n, 1 / math.sqrt(2 ** n), dtype=complex)
    for l in range(p):
        psi = psi * np.exp(-1j * params[l] * e)
        c, s = math.cos(params[p + l]), -1j * math.sin(params[p + l])
        psi = psi.reshape([2] * n)
        for q in range(n):
            ax = n - 1 - q
            a0, a1 = np.take(psi, 0, axis=ax), np.take(psi, 1, axis=ax)
            psi = np.stack([c * a0 + s * a1, s * a0 + c * a1], axis=ax)
        psi = psi.reshape(-1)
    return psi


def cvar(probs, e, alpha=CVAR_ALPHA):
    order = np.argsort(e); cum = acc = 0.0
    for i in order:
        take = min(probs[i], alpha - cum)
        if take <= 0:
            break
        acc += take * e[i]; cum += take
    return acc / alpha


def bits(i, n):
    return "".join("1" if (i >> j) & 1 else "0" for j in range(n))  # q0 first


def summarise_samples(samples, e, xs, idx, k, probs=None):
    ham = xs.sum(1)
    feas = ham[samples] == k
    fs = samples[feas]
    best = int(fs[np.argmin(e[fs])]) if feas.any() else None
    opt = int(np.argmin(np.where(ham == k, e, np.inf)))
    n = len(idx)
    uniq, counts = np.unique(samples, return_counts=True)
    order = np.argsort(-counts)[:12]
    top = [{"bits": bits(int(uniq[i]), n), "energy": float(e[uniq[i]]), "prob": float(counts[i] / len(samples)),
            "feasible": bool(ham[uniq[i]] == k), "optimal": int(uniq[i]) == opt} for i in order]
    return {
        "feasibleFrac": float(feas.mean()), "randomFeasibleFrac": math.comb(n, k) / 2 ** n,
        "foundOptimum": best == opt, "bestBits": bits(best, n) if best is not None else None,
        "bestEnergy": float(e[best]) if best is not None else None, "optimumEnergy": float(e[opt]),
        "selection": [idx[j] for j in range(n) if best is not None and (best >> j) & 1],
        "topSamples": top,
        "pOptimum": float(probs[opt]) if probs is not None else None,
    }


def qaoa_region(scenario, region, k, p=2, shots=4096, warm=None, seed=7):
    idx = geo.REGIONS[region]; n = len(idx)
    rng = np.random.default_rng(seed)
    Q, const, lam = build_qubo(scenario, idx, k)
    e, xs = all_energies(Q, const)
    scale = float(np.abs(e).max()); es = e / scale
    trace, evals = [], 0

    def f(pr):
        nonlocal evals
        evals += 1
        v = cvar(np.abs(qaoa_state(pr, es, n)) ** 2, es)
        trace.append(v * scale)
        return v

    t = time.perf_counter(); best = None
    starts = [np.array(warm["gammas"] + warm["betas"])] if warm and len(warm["gammas"]) == p else \
        [np.concatenate([rng.uniform(0, 2 * math.pi, p) * 0.3, rng.uniform(0, math.pi, p) * 0.3]) for _ in range(8)]
    for x0 in starts:
        r = minimize(f, x0, method="COBYLA", options={"maxiter": 150 if warm else 300})
        if best is None or r.fun < best.fun:
            best = r
    elapsed = time.perf_counter() - t
    probs = np.abs(qaoa_state(best.x, es, n)) ** 2
    samples = rng.choice(len(probs), size=shots, p=probs / probs.sum())
    out = summarise_samples(samples, e, xs, idx, k, probs)
    step = max(1, len(trace) // 160)
    running = np.minimum.accumulate(np.array(trace))
    out.update({
        "region": region, "qubits": n, "k": k, "p": p, "shots": shots, "lambda": lam,
        "zzTerms": int(np.count_nonzero(np.triu(Q, 1))), "costEvals": evals, "timeS": elapsed,
        "warmStarted": bool(warm), "params": {"gammas": best.x[:p].tolist(), "betas": best.x[p:].tolist(), "energyScale": scale},
        "trace": [{"eval": i + 1, "cvar": float(trace[i]), "best": float(running[i])} for i in range(0, len(trace), step)],
        "qubo": (Q / np.abs(Q).max()).round(3).tolist(), "candidateIds": idx, "status": "solved",
    })
    return out


def solve_qaoa_sim(scenario, k, p=2, shots=4096, previous=None, local=True):
    """previous: {"scenario": id, "regions": {name: {"selection", "mass", "params", "k"}}} from the last plan."""
    t = time.perf_counter(); ks = split_k(scenario, k); regions = {}
    for name in ("west", "east"):
        prev = (previous or {}).get("regions", {}).get(name)
        mass = region_mass(scenario, name)
        if local and prev and prev.get("k") == ks[name] and abs(mass - prev["mass"]) / max(prev["mass"], 1e-9) < 0.10:
            regions[name] = {**prev, "status": "reused", "timeS": 0.0, "costEvals": 0, "warmStarted": False}
            continue
        warm = prev.get("params") if prev and len(prev.get("params", {}).get("gammas", [])) == p else None
        r = qaoa_region(scenario, name, ks[name], p, shots, warm)
        r["mass"] = mass
        regions[name] = r
    sel = regions["west"]["selection"] + regions["east"]["selection"]
    return {"selection": sel, "coverage": coverage(sel, scenario), "timeS": time.perf_counter() - t, "regions": regions}


# ------------------------------------------------------------------ IBM hardware (optional)
def ibm_status():
    try:
        import qiskit  # noqa: F401
        from qiskit_ibm_runtime import QiskitRuntimeService
    except Exception:
        return {"qiskit": False, "ibmReady": False, "reason": "qiskit / qiskit-ibm-runtime not installed"}
    try:
        QiskitRuntimeService()
        return {"qiskit": True, "ibmReady": True}
    except Exception as ex:  # no saved account
        return {"qiskit": True, "ibmReady": False, "reason": f"no IBM Quantum account saved ({type(ex).__name__})"}


def _ising(Q):
    from qiskit.quantum_info import SparsePauliOp
    n = Q.shape[0]; terms = []
    for i in range(n):
        terms.append(("Z", [i], -Q[i, i] / 2 - sum(Q[i, j] for j in range(n) if j != i) / 2))
        for j in range(i + 1, n):
            if Q[i, j] != 0:
                terms.append(("ZZ", [i, j], Q[i, j] / 2))
    return SparsePauliOp.from_sparse_list(terms, num_qubits=n)


def solve_qaoa_ibm(scenario, k, p=2, shots=4096, backend_name=None):
    """Angles from the simulator are transferred to hardware; one Sampler V2 batch, DD + gate twirling."""
    from qiskit.circuit.library import QAOAAnsatz
    from qiskit.transpiler import generate_preset_pass_manager
    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2, Batch

    sim = solve_qaoa_sim(scenario, k, p, shots, local=False)
    service = QiskitRuntimeService()
    backend = service.backend(backend_name) if backend_name else service.least_busy(operational=True, simulator=False, min_num_qubits=20)
    pm = generate_preset_pass_manager(optimization_level=3, backend=backend)
    pubs, meta = [], []
    ks = split_k(scenario, k)
    for name in ("west", "east"):
        idx = geo.REGIONS[name]
        Q, const, _ = build_qubo(scenario, idx, ks[name])
        e, xs = all_energies(Q, const)
        prm = sim["regions"][name]["params"]
        ans = QAOAAnsatz(_ising(Q), reps=p); ans.measure_all()
        isa = pm.run(ans)
        vals = [prm["betas"][q.index] if q.vector.name.lower().startswith(("β", "b")) else prm["gammas"][q.index] / prm["energyScale"]
                for q in isa.parameters]
        pubs.append((isa, vals))
        ops = isa.count_ops()
        meta.append({"name": name, "idx": idx, "k": ks[name], "e": e, "xs": xs, "depth": isa.depth(),
                     "twoQubitGates": int(sum(v for g, v in ops.items() if g in ("cz", "ecr", "cx")))})
    t = time.perf_counter()
    with Batch(backend=backend) as batch:
        sampler = SamplerV2(mode=batch)
        sampler.options.dynamical_decoupling.enable = True
        sampler.options.twirling.enable_gates = True
        job = sampler.run(pubs, shots=shots)
        result = job.result()
    regions = {}
    for m, pub in zip(meta, result):
        counts = pub.data.meas.get_counts()
        samples = np.concatenate([np.full(c, int(b, 2)) for b, c in counts.items()])  # key is q_{n-1}..q_0
        r = summarise_samples(samples, m["e"], m["xs"], m["idx"], m["k"])
        r.update({"region": m["name"], "qubits": len(m["idx"]), "k": m["k"], "p": p, "shots": shots,
                  "depth": m["depth"], "twoQubitGates": m["twoQubitGates"], "status": "hardware",
                  "params": sim["regions"][m["name"]]["params"], "trace": sim["regions"][m["name"]]["trace"],
                  "qubo": sim["regions"][m["name"]]["qubo"], "candidateIds": m["idx"]})
        regions[m["name"]] = r
    sel = regions["west"]["selection"] + regions["east"]["selection"]
    usage = None
    try:
        usage = job.usage()
    except Exception:
        pass
    return {"selection": sel, "coverage": coverage(sel, scenario), "timeS": time.perf_counter() - t, "regions": regions,
            "backend": backend.name, "jobId": job.job_id(), "qpuSeconds": usage}


# ------------------------------------------------------------------ entry points
def solve(scenario, k, method, p=2, shots=4096, previous=None, local=True, backend=None):
    if method == "uniform":
        res = solve_uniform(scenario, k)
    elif method == "greedy":
        res = solve_greedy(scenario, k)
    elif method == "exact":
        res = dict(solve_exact(scenario, k))
    elif method == "qaoa_sim":
        res = solve_qaoa_sim(scenario, k, p, shots, previous, local)
    elif method == "qaoa_ibm":
        res = solve_qaoa_ibm(scenario, k, p, shots, backend)
    else:
        raise ValueError(f"unknown method {method}")
    exact = solve_exact(scenario, k)
    res.update({"method": method, "scenario": scenario, "k": k, "ratio": res["coverage"] / exact["coverage"],
                "exactCoverage": exact["coverage"]})
    return res


def benchmark(scenario, k):
    out = {}
    for m in ("uniform", "greedy", "exact", "qaoa_sim"):
        r = solve(scenario, k, m)
        out[m] = {"coverage": r["coverage"], "ratio": r["ratio"], "timeS": r.get("timeS", 0.0), "selection": r["selection"]}
    return out
