"""FastAPI entry point for Render / Railway (same solvers as server.py).

    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port $PORT

Routes live under /api/v1 to match the frontend's VITE_API_URL.
"""
import os
import sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qadr import geo, solvers  # noqa: E402

app = FastAPI(title="Q-ADR API", version="0.2.0")
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


class SolveIn(BaseModel):
    scenario: str = "t0"
    k: int = 6
    method: str = "qaoa_sim"
    p: int = 2
    shots: int = 4096
    previous: dict | None = None
    local: bool = True
    backend: str | None = None


@app.get("/api/v1/health")
def health():
    import time
    return {"ok": True, "time": time.time(), **solvers.ibm_status()}


@app.get("/api/v1/scenario")
def scenario(id: str = "t0"):
    if id not in geo.SCENARIOS:
        raise HTTPException(400, f"unknown scenario {id}")
    return geo.scenario_payload(id)


@app.get("/api/v1/quantum/benchmark")
def benchmark(id: str = "t0", k: int = 6):
    return solvers.benchmark(id, k)


@app.post("/api/v1/quantum/solve")
def solve(body: SolveIn):
    if not 2 <= body.k <= 8:
        raise HTTPException(400, "k must be between 2 and 8")
    if body.method == "qaoa_ibm" and not solvers.ibm_status()["ibmReady"]:
        raise HTTPException(503, solvers.ibm_status().get("reason", "IBM Quantum unavailable"))
    return solvers.solve(body.scenario, body.k, body.method, body.p, body.shots,
                         body.previous, body.local, body.backend)
