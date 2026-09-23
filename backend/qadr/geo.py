"""Krishna basin around Vijayawada, in real coordinates (lng, lat).

A 20 x 15 grid over lon 80.30-81.30, lat 15.80-16.90 (cells ~5.3 km x 8.1 km). The risk layer is a
rule-based prototype: distance to the Krishna and Budameru channels plus a low-lying-delta term.
The trained XGBoost model replaces `risk()` behind the same interface. River and coast polylines
are simplified hand-traced approximations for the prototype, not survey data.
"""
import math

LON0, LON1, LAT0, LAT1 = 80.30, 81.30, 15.80, 16.90
COLS, ROWS = 20, 15
DLON, DLAT = (LON1 - LON0) / COLS, (LAT1 - LAT0) / ROWS

KRISHNA = [(80.30, 16.62), (80.36, 16.575), (80.45, 16.555), (80.52, 16.56), (80.56, 16.53), (80.605, 16.506),
           (80.66, 16.48), (80.72, 16.445), (80.78, 16.36), (80.84, 16.25), (80.90, 16.12), (80.93, 16.02), (80.96, 15.90)]
KRISHNA_BRANCH = [(80.90, 16.12), (80.99, 16.00), (81.05, 15.88)]
BUDAMERU = [(80.50, 16.80), (80.55, 16.70), (80.60, 16.60), (80.63, 16.545), (80.67, 16.53), (80.80, 16.56),
            (80.95, 16.58), (81.10, 16.60)]
COAST = [(81.30, 16.36), (81.22, 16.28), (81.15, 16.17), (81.08, 16.02), (81.02, 15.90), (80.97, 15.80)]
CITY = {"name": "Vijayawada", "lng": 80.648, "lat": 16.506}

# Candidate staging sites: real towns / localities, used as hypothetical pre-positioning points.
CANDIDATES = [
    ("Ibrahimpatnam", 80.52, 16.59), ("Kondapalli", 80.54, 16.62), ("Mylavaram", 80.64, 16.76), ("Nuzvid", 80.85, 16.79),
    ("Amaravati", 80.36, 16.57), ("Tadepalli", 80.60, 16.48), ("Mangalagiri", 80.57, 16.43), ("Singh Nagar", 80.633, 16.535),
    ("Gunadala", 80.668, 16.525), ("Kanuru", 80.69, 16.49), ("Penamaluru", 80.716, 16.445), ("Gannavaram", 80.80, 16.54),
    ("Kankipadu", 80.77, 16.43), ("Hanuman Junction", 80.97, 16.64), ("Vuyyuru", 80.84, 16.36), ("Gudivada", 80.99, 16.43),
    ("Pamarru", 80.96, 16.33), ("Tenali", 80.64, 16.24), ("Challapalli", 80.93, 16.11), ("Repalle", 80.83, 16.02),
    ("Avanigadda", 80.92, 16.02), ("Pedana", 81.14, 16.25), ("Kaikaluru", 81.21, 16.55),
]
UNIFORM_PLAN = [1, 5, 8, 12, 15, 19]
COVER_KM = 11.0
SPLIT_LON = 80.75

SCENARIOS = {
    "t0": {"label": "T0 · forecast issued", "model": "base"},
    "t6": {"label": "T+6 h · Budameru surge", "model": "north"},
    "t12": {"label": "T+12 h · delta flooding", "model": "delta"},
}
LEVELS = [(0.30, "low"), (0.48, "moderate"), (0.66, "high"), (0.85, "severe")]


def km(a, b):
    """Equirectangular distance in km between (lng, lat) points: accurate to <0.5% at this scale."""
    mlat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((b[0] - a[0]) * 111.32 * math.cos(mlat), (b[1] - a[1]) * 110.57)


def _to_xy(p):
    return (p[0] * 111.32 * math.cos(math.radians(16.35)), p[1] * 110.57)


def _seg(p, a, b):
    (px, py), (ax, ay), (bx, by) = _to_xy(p), _to_xy(a), _to_xy(b)
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def _pl(p, pts, keep=lambda a, b: True):
    best = 1e9
    for a, b in zip(pts, pts[1:]):
        if keep(a, b):
            best = min(best, _seg(p, a, b))
    return best


def coast_lng(lat):
    if lat >= COAST[0][1]:
        return 999.0
    for a, b in zip(COAST, COAST[1:]):
        if b[1] <= lat <= a[1]:
            t = (a[1] - lat) / (a[1] - b[1])
            return a[0] + t * (b[0] - a[0])
    return COAST[-1][0]


def in_sea(lng, lat):
    return lng > coast_lng(lat)


def risk(lng, lat, scenario):
    m = SCENARIOS[scenario]["model"]
    p = (lng, lat)
    dk = min(_pl(p, KRISHNA), _pl(p, KRISHNA_BRANCH))
    db = _pl(p, BUDAMERU)
    dcoast = _pl(p, COAST)
    low = max(0.0, 1 - dcoast / 55) * max(0.0, min(1.0, (16.55 - lat) / 0.5))
    if m == "base":
        return 0.66 * math.exp(-dk / 11) + 0.55 * math.exp(-db / 8) + 0.40 * low
    if m == "north":
        dku = _pl(p, KRISHNA, lambda a, b: a[0] < 80.70)
        return 0.35 * math.exp(-dk / 9) + 0.45 * math.exp(-dku / 8) + 0.95 * math.exp(-db / 8) + 0.15 * low
    dkd = min(_pl(p, KRISHNA, lambda a, b: b[1] < 16.42), _pl(p, KRISHNA_BRANCH))
    return 0.25 * math.exp(-dk / 9) + 0.75 * math.exp(-dkd / 10) + 0.15 * math.exp(-db / 6) + 0.55 * low


def level(r):
    out = None
    for t, name in LEVELS:
        if r >= t:
            out = name
    return out


CELLS = []  # (lng, lat) centres of land cells
for j in range(ROWS):
    for i in range(COLS):
        c = (round(LON0 + (i + 0.5) * DLON, 5), round(LAT1 - (j + 0.5) * DLAT, 5))
        if not in_sea(*c):
            CELLS.append(c)
SITES = [(lng, lat) for _, lng, lat in CANDIDATES]
COVERS = [frozenset(c for c in CELLS if km(c, s) <= COVER_KM) for s in SITES]
REGIONS = {"west": [i for i, (lng, _) in enumerate(SITES) if lng < SPLIT_LON],
           "east": [i for i, (lng, _) in enumerate(SITES) if lng >= SPLIT_LON]}


def scenario_payload(scenario):
    cells = []
    for (lng, lat) in CELLS:
        r = risk(lng, lat, scenario)
        cells.append({"lng": lng, "lat": lat, "risk": round(r, 4), "level": level(r)})
    return {
        "id": scenario, "label": SCENARIOS[scenario]["label"],
        "grid": {"lon0": LON0, "lon1": LON1, "lat0": LAT0, "lat1": LAT1, "dlon": DLON, "dlat": DLAT},
        "cells": cells,
        "candidates": [{"id": i, "name": n, "lng": lng, "lat": lat, "region": "west" if lng < SPLIT_LON else "east"}
                       for i, (n, lng, lat) in enumerate(CANDIDATES)],
        "rivers": {"krishna": KRISHNA, "krishnaBranch": KRISHNA_BRANCH, "budameru": BUDAMERU},
        "coast": COAST, "city": CITY, "coverKm": COVER_KM, "splitLng": SPLIT_LON, "uniformPlan": UNIFORM_PLAN,
    }
