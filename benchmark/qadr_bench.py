"""QADR benchmark: flood-response site placement on the Krishna / Vijayawada grid instance.

Methods compared on the SAME instance:
  1. uniform spacing (static plan)          2. greedy max-coverage heuristic
  3. exact exhaustive search (optimum)      4. QAOA, p=2, ideal statevector (NumPy)
The hardware run (5. QAOA on an IBM Heron QPU) lives in run_ibm.py and reuses the
QUBOs and optimised angles produced here.

Run:  python qadr_bench.py        -> prints the table and writes results.json
Needs only numpy + scipy.
"""
import itertools, json, math, time
import numpy as np
from scipy.optimize import minimize
from model import CANDS, CELLS, COVER_R, NAIVE, risk, greedy

K = 6            # units to place
MODE = "base"    # risk state (T0)
P = 2            # QAOA layers
SHOTS = 4096
CVAR_ALPHA = 0.2

W = {c: max(0.0, risk(*c, MODE) - 0.3) ** 1.5 for c in CELLS}   # risk weight per grid cell
TOTAL = sum(W.values())
COV = [frozenset(c for c in CELLS if math.hypot(c[0]-s[0], c[1]-s[1]) <= COVER_R) for s in CANDS]


def coverage(sel):
    """True objective: risk-weighted share of cells covered by at least one chosen site."""
    cov = set().union(*[COV[i] for i in sel]) if sel else set()
    return sum(W[c] for c in cov)


def build_qubo(idx, k, lam2):
    """f(x) = -sum w_i x_i + sum_{i<j} o_ij x_i x_j + lam2 (sum x_i - k)^2  as x^T Q x + const (Q symmetric)."""
    n = len(idx)
    w = np.array([sum(W[c] for c in COV[i]) for i in idx])
    Q = np.zeros((n, n))
    for a in range(n):
        Q[a, a] = -w[a] + lam2 * (1 - 2 * k)
        for b in range(a + 1, n):
            ov = sum(W[c] for c in COV[idx[a]] & COV[idx[b]])
            Q[a, b] = Q[b, a] = (ov + 2 * lam2) / 2
    return Q, lam2 * k * k


def all_energies(Q, const):
    n = Q.shape[0]
    xs = ((np.arange(2 ** n)[:, None] >> np.arange(n)[None, :]) & 1).astype(float)  # bit j = qubit j
    return np.einsum("si,ij,sj->s", xs, Q, xs) + const, xs


def qaoa_state(params, e, n):
    """|psi> = prod_l exp(-i beta_l sum X) exp(-i gamma_l E) |+>^n ; params = [gammas..., betas...]."""
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


def subproblem(idx, k):
    wmax = max(sum(W[c] for c in COV[i]) for i in idx)
    lam2 = 0.6 * wmax
    Q, const = build_qubo(idx, k, lam2)
    e, xs = all_energies(Q, const)
    scale = float(np.abs(e).max())
    return Q, const, e, xs, scale


def decode(samples, e, xs, idx, k):
    ham = xs.sum(1)
    feas = ham[samples] == k
    fs = samples[feas]
    best = int(fs[np.argmin(e[fs])]) if feas.any() else None
    sel = [idx[j] for j in range(len(idx)) if best is not None and (best >> j) & 1]
    return feas, best, sel


def run_qaoa(idx, k, seed=7):
    rng = np.random.default_rng(seed)
    Q, const, e, xs, scale = subproblem(idx, k)
    n, es = len(idx), e / scale
    best, evals = None, 0
    t = time.perf_counter()
    for _ in range(8):                                    # multi-start COBYLA on CVaR
        x0 = np.concatenate([rng.uniform(0, 2 * math.pi, P) * 0.3, rng.uniform(0, math.pi, P) * 0.3])
        def f(pr):
            nonlocal evals; evals += 1
            return cvar(np.abs(qaoa_state(pr, es, n)) ** 2, es)
        r = minimize(f, x0, method="COBYLA", options={"maxiter": 300})
        if best is None or r.fun < best.fun:
            best = r
    elapsed = time.perf_counter() - t
    probs = np.abs(qaoa_state(best.x, es, n)) ** 2
    samples = rng.choice(len(probs), size=SHOTS, p=probs / probs.sum())
    feas, best_s, sel = decode(samples, e, xs, idx, k)
    ham = xs.sum(1)
    opt = int(np.argmin(np.where(ham == k, e, np.inf)))
    return {
        "idx": idx, "k": k, "qubits": n, "p": P, "shots": SHOTS,
        "zz_terms_per_layer": int(np.count_nonzero(np.triu(Q, 1))),
        "feasible_frac": float(feas.mean()),
        "random_feasible_frac": math.comb(n, k) / 2 ** n,
        "found_subproblem_opt": best_s == opt,
        "best_bitstring_q0_first": format(best_s, f"0{n}b")[::-1] if best_s is not None else None,
        "sel": sel, "cost_evals": evals, "time_s": elapsed,
        "gammas_normalised": best.x[:P].tolist(), "betas": best.x[P:].tolist(), "energy_scale": scale,
    }


def regions():
    west = [i for i, (x, _) in enumerate(CANDS) if x < 400]
    east = [i for i, (x, _) in enumerate(CANDS) if x >= 400]
    mass = lambda ids: sum(W[c] for c in set().union(*[COV[i] for i in ids]))
    kw = round(K * mass(west) / (mass(west) + mass(east)))
    return {"west": (west, kw), "east": (east, K - kw)}


def main():
    res = {"instance": {"candidates": len(CANDS), "k": K, "cells": len(CELLS), "cover_radius": COVER_R,
                        "plans": math.comb(len(CANDS), K)}}
    res["uniform"] = {"sel": NAIVE, "cov": coverage(NAIVE) / TOTAL}
    t = time.perf_counter(); g = greedy(MODE, K)
    res["greedy"] = {"sel": g, "cov": coverage(g) / TOTAL, "time_s": time.perf_counter() - t}
    t = time.perf_counter(); best, bsel = -1, None
    for comb in itertools.combinations(range(len(CANDS)), K):
        v = coverage(comb)
        if v > best:
            best, bsel = v, comb
    res["exact"] = {"sel": list(bsel), "cov": best / TOTAL, "time_s": time.perf_counter() - t}
    t = time.perf_counter(); sub = {}
    for name, (ids, k) in regions().items():
        sub[name] = run_qaoa(ids, k)
    sel = sub["west"]["sel"] + sub["east"]["sel"]
    res["qaoa_sim"] = {**sub, "sel": sel, "cov": coverage(sel) / TOTAL, "time_s": time.perf_counter() - t}
    for m in ("uniform", "greedy", "exact", "qaoa_sim"):
        res[m]["ratio"] = res[m]["cov"] / res["exact"]["cov"]
    json.dump(res, open("results.json", "w"), indent=1, default=str)
    for m in ("uniform", "greedy", "exact", "qaoa_sim"):
        r = res[m]
        print(f"{m:9s} coverage={r['cov']*100:5.1f}%  ratio={r['ratio']:.3f}  time={r.get('time_s', 0):.2f}s  sel={r['sel']}")
    for name in ("west", "east"):
        q = sub[name]
        print(f"  {name}: {q['qubits']} qubits, k={q['k']}, ZZ/layer={q['zz_terms_per_layer']}, "
              f"feasible={q['feasible_frac']:.1%} (random {q['random_feasible_frac']:.1%}), "
              f"hit QUBO optimum={q['found_subproblem_opt']}, best={q['best_bitstring_q0_first']}")
    return res


if __name__ == "__main__":
    main()
