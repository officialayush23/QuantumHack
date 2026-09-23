"""Q-ADR demo API (standard library only + numpy/scipy).

    pip install numpy scipy
    python server.py                 # http://localhost:8000

Endpoints
    GET  /api/health                      solver + IBM availability
    GET  /api/scenario?id=t0|t6|t12       grid, risk cells, candidate sites, rivers
    POST /api/solve                       {scenario, k, method, p, shots, previous?, local?, backend?}
    GET  /api/benchmark?id=t0&k=6         uniform vs greedy vs exact vs QAOA (sim)
method: uniform | greedy | exact | qaoa_sim | qaoa_ibm
"""
import json, os, sys, time, traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qadr import geo, solvers  # noqa: E402

PORT = int(os.environ.get("PORT", 8000))


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path == "/api/health":
                return self._send(200, {"ok": True, "time": time.time(), **solvers.ibm_status()})
            if u.path == "/api/scenario":
                sid = q.get("id", "t0")
                if sid not in geo.SCENARIOS:
                    return self._send(400, {"error": f"unknown scenario {sid}"})
                return self._send(200, geo.scenario_payload(sid))
            if u.path == "/api/benchmark":
                return self._send(200, solvers.benchmark(q.get("id", "t0"), int(q.get("k", 6))))
            self._send(404, {"error": "not found"})
        except Exception as ex:
            traceback.print_exc(); self._send(500, {"error": str(ex)})

    def do_POST(self):
        u = urlparse(self.path)
        try:
            n = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(n) or b"{}")
            if u.path == "/api/solve":
                k = int(body.get("k", 6))
                if not 2 <= k <= 8:
                    return self._send(400, {"error": "k must be between 2 and 8"})
                if body.get("method") == "qaoa_ibm" and not solvers.ibm_status()["ibmReady"]:
                    return self._send(503, {"error": solvers.ibm_status().get("reason", "IBM Quantum unavailable")})
                res = solvers.solve(body.get("scenario", "t0"), k, body.get("method", "qaoa_sim"),
                                    int(body.get("p", 2)), int(body.get("shots", 4096)),
                                    body.get("previous"), bool(body.get("local", True)), body.get("backend"))
                return self._send(200, res)
            self._send(404, {"error": "not found"})
        except Exception as ex:
            traceback.print_exc(); self._send(500, {"error": str(ex)})

    def log_message(self, fmt, *args):
        sys.stderr.write("[qadr] " + fmt % args + "\n")


if __name__ == "__main__":
    print(f"Q-ADR API on http://localhost:{PORT}  ({solvers.ibm_status()})")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
