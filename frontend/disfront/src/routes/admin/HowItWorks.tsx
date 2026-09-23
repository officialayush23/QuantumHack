import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"


const FLOW = [
  { t: "Sense", d: "Citizen app, crews, agencies, sensors; live river discharge and rain", tag: "Data" },
  { t: "Triage", d: "Six-component trust; reports → incidents; bursts held", tag: "AI agent" },
  { t: "Predict", d: "Risk grid per risk state from river, rain and terrain", tag: "ML" },
  { t: "Position", d: "QUBO → ≤20-qubit regions → QAOA → six staging posts; re-solved when risk moves", tag: "Quantum", q: true },
  { t: "Dispatch & route", d: "From the posts: severity² × people, ETA, switching cost; closures avoided", tag: "AI agents" },
  { t: "Gate", d: "Delegation rules; officers approve what the rules do not cover", tag: "Rules + people" },
  { t: "Ask & act", d: "Copilot over the same tools; field and citizen apps", tag: "AI" },
]

const CLAIMS = [
  { c: "Quantum is load-bearing, not decorative", b: "Every dispatch starts from a QAOA post. Overview shows drive time to life-safety calls from home stations vs from the posts." },
  { c: "Quantum is used where the problem is combinatorial", b: "Staging placement is a QUBO over 23 towns; forecasting and trust stay classical." },
  { c: "No quantum advantage is claimed", b: "Benchmark screen shows greedy and exhaustive search next to QAOA for every risk state." },
  { c: "Re-planning is cheap", b: "Warm-started QAOA re-solves in ~150 cost evaluations instead of 2,400; unchanged regions are reused." },
  { c: "Nothing issues because a model was confident", b: "Outside teams and camp overflow stop at Approvals with the rule that stopped them." },
  { c: "Routes say how good they are", b: "Mapbox (avoids closures) → OSRM → straight line, and the engine is shown on every route." },
  { c: "Every decision is traceable", b: "Append-only event log; each line names what caused it; exportable from After-action." },
]

export default function HowItWorks() {
  return (
    <>
      <PageHeader title="How this works" description="Quantum-Assisted Disaster Response Optimization: the whole system on one page." />
      <TourAnchor id="h-flow">
        <Card>
          <CardHeader><CardTitle>ML, quantum and agents in one loop</CardTitle><CardDescription>Orange: the quantum stage. Everything after it starts from where it put the crews.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap items-stretch gap-2">
            {FLOW.map((f, i) => (
              <div key={f.t} className="flex items-center gap-2">
                <div className={`flex w-40 flex-col gap-1 rounded-xl border p-3 ${f.q ? "border-primary bg-primary/10" : ""}`}>
                  <span className="flex items-center justify-between gap-1 text-sm font-medium">{f.t}<Badge variant={f.q ? "default" : "outline"} className="text-[10px]">{f.tag}</Badge></span>
                  <span className="text-xs text-muted-foreground">{f.d}</span>
                </div>
                {i < FLOW.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}
              </div>
            ))}
          </CardContent>
        </Card>
      </TourAnchor>
      <TourAnchor id="h-claims" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CLAIMS.map((x) => (
          <Card key={x.c} size="sm">
            <CardHeader><CardTitle>{x.c}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{x.b}</CardContent>
          </Card>
        ))}
      </TourAnchor>
      <Card size="sm">
        <CardHeader><CardTitle>Stack</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {["React 19 + Vite", "shadcn/ui", "Mapbox GL", "Zustand", "FastAPI (backend)", "Supabase Postgres + PostGIS", "Qiskit + IBM Quantum Runtime", "NumPy statevector QAOA", "Open-Meteo / GloFAS", "Vercel · Render"].map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
        </CardContent>
      </Card>
    </>
  )
}
