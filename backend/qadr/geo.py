"""Krishna / Vijayawada prototype grid: geometry, candidate sites and the prototype risk layer.

Map units: 800 x 600, 40-unit grid cells (20 x 15). The risk layer is a rule-based prototype
(distance to river channels + low-lying terrain proxy); the trained XGBoost model replaces
`risk()` behind the same interface.
"""
import math

W, H, CELL = 800, 600, 40

KRISHNA = [(0, 190), (80, 200), (160, 225), (240, 240), (300, 255), (345, 268), (400, 300), (450, 350),
           (500, 400), (540, 450), (580, 480), (620, 500), (662, 512)]
KRISHNA_BRANCH = [(580, 480), (600, 520), (612, 562)]
BUDAMERU = [(230, 40), (260, 110), (300, 170), (330, 230), (345, 262)]
ROAD = [(790, 60), (560, 170), (345, 268), (250, 420), (180, 600)]
DISTRICTS = [[(0, 380), (120, 360), (220, 400), (300, 520), (330, 600)], [(470, 0), (480, 120), (430, 220), (460, 300)]]
COAST = [(560, 600), (800, 380), (800, 600)]
CITY = {"name": "Vijayawada", "x": 345, "y": 268}
CANDIDATES = [(120, 150), (200, 120), (290, 90), (380, 140), (460, 120), (560, 160), (660, 210), (90, 300),
              (180, 290), (260, 330), (350, 320), (430, 260), (520, 300), (620, 330), (140, 440), (240, 470),
              (330, 430), (420, 420), (500, 470), (470, 540), (380, 540), (620, 420), (700, 330)]
UNIFORM_PLAN = [1, 5, 7, 12, 15, 21]
COVER_R = 85

SCENARIOS = {
    "t0": {"label": "T0 · forecast issued", "model": "base"},
    "t6": {"label": "T+6 h · Budameru surge", "model": "north"},
    "t12": {"label": "T+12 h · delta flooding", "model": "delta"},
}
LEVELS = [(0.30, "low"), (0.48, "moderate"), (0.66, "high"), (0.85, "severe")]


def in_sea(x, y):
    return x > 560 and y > 600 - (x - 560) * 0.9167


def _seg(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def _pl(p, pts, xmin=-1, xmax=9999):
    best = 1e9
    for a, b in zip(pts, pts[1:]):
        if (a[0] < xmin and b[0] < xmin) or (a[0] > xmax and b[0] > xmax):
            continue
        best = min(best, _seg(p, a, b))
    return best


def risk(x, y, scenario):
    m = SCENARIOS[scenario]["model"]
    dk = min(_pl((x, y), KRISHNA), _pl((x, y), KRISHNA_BRANCH))
    db = _pl((x, y), BUDAMERU)
    low = max(0, min(1, (x - 300) / 500)) * max(0, min(1, (y - 250) / 350))
    if m == "base":
        return 0.62 * math.exp(-dk / 70) + 0.5 * math.exp(-db / 45) + 0.35 * low
    if m == "north":
        dku = _pl((x, y), KRISHNA, xmax=420)
        return 0.35 * math.exp(-dk / 70) + 0.45 * math.exp(-dku / 60) + 0.95 * math.exp(-db / 60) + 0.15 * low
    dkd = min(_pl((x, y), KRISHNA, xmin=420), _pl((x, y), KRISHNA_BRANCH))
    return 0.25 * math.exp(-dk / 70) + 0.75 * math.exp(-dkd / 80) + 0.15 * math.exp(-db / 45) + 0.55 * low


def level(r):
    out = None
    for t, name in LEVELS:
        if r >= t:
            out = name
    return out


CELLS = [(i * CELL + CELL // 2, j * CELL + CELL // 2) for j in range(H // CELL) for i in range(W // CELL)
         if not in_sea(i * CELL + CELL // 2, j * CELL + CELL // 2)]
COVERS = [frozenset(c for c in CELLS if math.hypot(c[0] - s[0], c[1] - s[1]) <= COVER_R) for s in CANDIDATES]
REGIONS = {"west": [i for i, (x, _) in enumerate(CANDIDATES) if x < 400],
           "east": [i for i, (x, _) in enumerate(CANDIDATES) if x >= 400]}


def scenario_payload(scenario):
    cells = []
    for (x, y) in CELLS:
        r = risk(x, y, scenario)
        cells.append({"x": x, "y": y, "risk": round(r, 4), "level": level(r)})
    return {
        "id": scenario, "label": SCENARIOS[scenario]["label"],
        "size": {"w": W, "h": H, "cell": CELL}, "cells": cells,
        "candidates": [{"id": i, "x": x, "y": y, "region": "west" if x < 400 else "east"} for i, (x, y) in enumerate(CANDIDATES)],
        "rivers": {"krishna": KRISHNA, "krishnaBranch": KRISHNA_BRANCH, "budameru": BUDAMERU},
        "road": ROAD, "districts": DISTRICTS, "coast": COAST, "city": CITY, "coverRadius": COVER_R,
        "uniformPlan": UNIFORM_PLAN,
    }
