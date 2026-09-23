"""Writes ../frontend snapshot used when the API is offline (static demo / hosted link)."""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qadr import geo, solvers
out = {"scenarios": {}, "solves": {}, "benchmarks": {}, "generatedWith": "qadr solvers, k=6, p=2, 4096 shots"}
prev = None
for sid in ("t0", "t6", "t12"):
    out["scenarios"][sid] = geo.scenario_payload(sid)
    r = solvers.solve(sid, 6, "qaoa_sim", 2, 4096, prev, True)
    out["solves"][sid] = r
    prev = {"scenario": sid, "regions": r["regions"]}
    out["benchmarks"][sid] = solvers.benchmark(sid, 6)
    print(sid, round(r["ratio"], 3), [(n, x["status"], x.get("costEvals")) for n, x in r["regions"].items()])
path = sys.argv[1] if len(sys.argv) > 1 else "snapshot.json"
json.dump(out, open(path, "w"), separators=(",", ":"))
print("wrote", path, os.path.getsize(path) // 1024, "KB")
