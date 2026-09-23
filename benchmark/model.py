import math
BG = "#F5F2EA"; DARK = "#1C1B19"; INK = "#171717"; SEC = "#5A5A5A"
ACC = "#E56A1F"; ACCT = "#B04A12"; RED = "#C83A2A"; GRN = "#4F7658"; GREY = "#D8D5CE"
LT = "#F5F2EA"; LSEC = "#A9A59C"
SANS = "'IBM Plex Sans', Arial, sans-serif"
MONO = "'IBM Plex Mono', 'Courier New', monospace"
TOTAL = 15
TAG = "Quantum-Assisted Disaster Response Optimization"

# ---------------------------------------------------------------- map model
K = [(0,190),(80,200),(160,225),(240,240),(300,255),(345,268),(400,300),(450,350),(500,400),(540,450),(580,480),(620,500),(662,512)]
K2 = [(580,480),(600,520),(612,562)]
B = [(230,40),(260,110),(300,170),(330,230),(345,262)]
ROAD = [(790,60),(560,170),(345,268),(250,420),(180,600)]
DIST1 = [(0,380),(120,360),(220,400),(300,520),(330,600)]
DIST2 = [(470,0),(480,120),(430,220),(460,300)]
CANDS = [(120,150),(200,120),(290,90),(380,140),(460,120),(560,160),(660,210),(90,300),(180,290),(260,330),
         (350,320),(430,260),(520,300),(620,330),(140,440),(240,470),(330,430),(420,420),(500,470),(470,540),
         (380,540),(620,420),(700,330)]
NAIVE = [1,5,7,12,15,21]
CITY = (345,268)

def in_sea(x, y):
    return x > 560 and y > 600 - (x - 560) * 0.9167

def seg_d(p, a, b):
    (px,py),(ax,ay),(bx,by) = p,a,b
    dx,dy = bx-ax, by-ay
    t = max(0,min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)))
    return math.hypot(px-ax-t*dx, py-ay-t*dy)

def pl_d(p, pts, xmin=-1, xmax=9999):
    best = 1e9
    for a,b in zip(pts, pts[1:]):
        if a[0] < xmin and b[0] < xmin: continue
        if a[0] > xmax and b[0] > xmax: continue
        best = min(best, seg_d(p,a,b))
    return best

def risk(x, y, mode):
    dk = min(pl_d((x,y),K), pl_d((x,y),K2)); db = pl_d((x,y),B)
    low = max(0,min(1,(x-300)/500))*max(0,min(1,(y-250)/350))
    if mode == "base":
        return 0.62*math.exp(-dk/70) + 0.5*math.exp(-db/45) + 0.35*low
    if mode == "north":
        dku = pl_d((x,y),K,xmax=420)
        return 0.35*math.exp(-dk/70) + 0.45*math.exp(-dku/60) + 0.95*math.exp(-db/60) + 0.15*low
    if mode == "delta":
        dkd = min(pl_d((x,y),K,xmin=420), pl_d((x,y),K2))
        return 0.25*math.exp(-dk/70) + 0.75*math.exp(-dkd/80) + 0.15*math.exp(-db/45) + 0.55*low
    return 0

LEVELS = [(0.30,"#F1DDC6"),(0.48,"#EDB185"),(0.66,ACC),(0.85,RED)]
def level(r):
    c = None
    for t,col in LEVELS:
        if r >= t: c = col
    return c

CELLS = [(i*40+20, j*40+20) for j in range(15) for i in range(20) if not in_sea(i*40+20, j*40+20)]
COVER_R = 85

def greedy(mode, k=6):
    w = {c: (max(0,risk(*c,mode)-0.3))**1.5 for c in CELLS}
    chosen, covered = [], set()
    for _ in range(k):
        best, bi = -1, None
        for i,s in enumerate(CANDS):
            if i in chosen: continue
            g = sum(w[c] for c in CELLS if c not in covered and math.hypot(c[0]-s[0],c[1]-s[1]) <= COVER_R)
            if g > best: best, bi = g, i
        chosen.append(bi)
        covered |= {c for c in CELLS if math.hypot(c[0]-CANDS[bi][0],c[1]-CANDS[bi][1]) <= COVER_R}
    return chosen
