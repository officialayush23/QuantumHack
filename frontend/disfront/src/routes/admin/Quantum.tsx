import * as React from "react"
import { Clapperboard, Play, Square } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Kpi, PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { MapView, type RiskCellF, type SiteF } from "@/components/map/MapView"
import { BenchmarkPanel } from "@/components/qadr/benchmark-panel"
import { PipelineStatus, STAGES } from "@/components/qadr/pipeline-status"
import { PlanTable } from "@/components/qadr/plan-table"
import { RegionCard } from "@/components/qadr/qaoa-panel"
import { dataMode } from "@/config/env"
import type { LngLat } from "@/lib/geo"
import { METHODS, SCENARIOS, getBenchmark, getScenario, pct, solve, type Benchmark, type Method, type Scenario, type ScenarioId, type SolveResult } from "@/lib/qadr"
import { useWorld } from "@/store/world"


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function Quantum() {
  const snapshot = useWorld((s) => s.snapshot)
  const online = dataMode === "api"
  const [sid, setSid] = React.useState<ScenarioId>("t0")
  const [scenario, setScenario] = React.useState<Scenario | null>(null)
  const [method, setMethod] = React.useState<Method>("qaoa_sim")
  const [adaptive, setAdaptive] = React.useState(true)
  const [result, setResult] = React.useState<SolveResult | null>(null)
  const [prevSel, setPrevSel] = React.useState<number[]>([])
  const [sampling, setSampling] = React.useState<number[] | null>(null)
  const [stage, setStage] = React.useState(-1)
  const [running, setRunning] = React.useState(false)
  const [story, setStory] = React.useState<number | null>(null)
  const [revealKey, setRevealKey] = React.useState(0)
  const [bench, setBench] = React.useState<Benchmark | null>(null)
  const [benchLoading, setBenchLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const runId = React.useRef(0)
  const storyId = React.useRef(0)
  const resultRef = React.useRef<SolveResult | null>(null)
  React.useEffect(() => { resultRef.current = result }, [result])

  const load = React.useCallback(async (id: ScenarioId) => {
    const sc = !online && snapshot ? snapshot.scenarios[id] : await getScenario(id, online)
    setScenario(sc); setSid(id); setBench(null)
    return sc
  }, [online, snapshot])

  const run = React.useCallback(async (sc: Scenario, replan: boolean) => {
    const my = ++runId.current
    const alive = () => runId.current === my
    setRunning(true); setError(null); setStage(0); setSampling(null)
    const prev = resultRef.current
    try {
      const res = await solve({ scenario: sc.id, k: 6, method, p: 2, shots: 4096, local: adaptive, previous: replan && adaptive && prev?.regions ? { scenario: prev.scenario, regions: prev.regions } : undefined }, online)
      for (let s = 0; s < 3 && alive(); s++) { setStage(s); await sleep(450) }
      if (!alive()) return
      setStage(3)
      const regions = res.regions ? Object.values(res.regions) : []
      if (regions.some((r) => r.status !== "reused")) {
        for (let f = 0; f < 16 && alive(); f++) {
          setSampling(regions.flatMap((r) => {
            if (r.status === "reused") return r.selection
            const smp = r.topSamples[(f * 3 + r.qubits) % r.topSamples.length]
            return r.candidateIds.filter((_, j) => smp.bits[j] === "1")
          }))
          await sleep(170)
        }
      } else await sleep(500)
      if (!alive()) return
      setSampling(null); setStage(4); await sleep(350)
      if (!alive()) return
      setStage(STAGES.length)
      setPrevSel(replan && prev ? prev.selection : [])
      setResult(res); setRevealKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStage(-1)
    } finally {
      if (alive()) setRunning(false)
    }
  }, [method, adaptive, online])

  React.useEffect(() => {
    if (!snapshot && !online) return
    let off = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first solve on mount
    void load("t0").then((sc) => { if (!off) void run(sc, false) })
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot])

  const playStory = async () => {
    const my = ++storyId.current
    setResult(null); setPrevSel([])
    for (let i = 0; i < SCENARIOS.length; i++) {
      if (storyId.current !== my) return
      setStory(i)
      const sc = await load(SCENARIOS[i].id)
      await sleep(900)
      if (storyId.current !== my) return
      await run(sc, i > 0)
      await sleep(2400)
    }
    if (storyId.current === my) setStory(null)
  }

  const risk = React.useMemo<RiskCellF[]>(() => (scenario ? scenario.cells.map((c) => ({ ...c, dlon: scenario.grid.dlon, dlat: scenario.grid.dlat })) : []), [scenario])
  const selection = React.useMemo(() => (result?.scenario === sid ? result.selection : []), [result, sid])
  const sites = React.useMemo<SiteF[]>(() => (scenario ? scenario.candidates.map((c) => ({ id: c.id, name: c.name, pos: [c.lng, c.lat], selected: selection.includes(c.id) })) : []), [scenario, selection])
  const coverage = React.useMemo(() => (scenario ? selection.map((id) => ({ pos: [scenario.candidates[id].lng, scenario.candidates[id].lat] as LngLat, km: scenario.coverKm })) : []), [scenario, selection])
  const samples = React.useMemo<LngLat[]>(() => (scenario && sampling ? sampling.map((id) => [scenario.candidates[id].lng, scenario.candidates[id].lat] as LngLat) : []), [scenario, sampling])
  const regions = result?.regions ? Object.values(result.regions) : []
  const meanFeasible = regions.length ? regions.reduce((a, r) => a + r.feasibleFrac, 0) / regions.length : null
  const evals = regions.reduce((a, r) => a + r.costEvals, 0)
  const busy = running || story !== null

  return (
    <>
      <PageHeader title="Quantum planner" description="Where response units should wait before the calls come in. Placement is a QUBO; QAOA samples it on a simulator (or IBM hardware through the backend); classical solvers stay as baseline and fallback." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{scenario?.label ?? "Loading"}</CardTitle>
            <CardDescription>6 staging posts · 23 candidate towns · 271 grid cells · 11 km coverage</CardDescription>
            <CardAction className="flex flex-wrap gap-2">
              <TourAnchor id="q-scenario">
                <ToggleGroup type="single" variant="outline" size="sm" value={sid} disabled={busy}
                  onValueChange={(v) => { if (!v) return; void load(v as ScenarioId).then((sc) => run(sc, true)) }}>
                  {SCENARIOS.map((s) => <ToggleGroupItem key={s.id} value={s.id}>{s.short}</ToggleGroupItem>)}
                </ToggleGroup>
              </TourAnchor>
              <TourAnchor id="q-play">
                {story === null
                  ? <Button size="sm" onClick={() => void playStory()} disabled={running}><Clapperboard /> Play quantum re-plan</Button>
                  : <Button size="sm" variant="outline" onClick={() => { storyId.current++; runId.current++; setStory(null); setRunning(false); setSampling(null) }}><Square /> Stop</Button>}
              </TourAnchor>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {story !== null && (
              <div className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between gap-2"><span>{SCENARIOS[story].short} · {SCENARIOS[story].label}: {story === 0 ? "solved from scratch" : "re-solved with warm start; unchanged regions reused"}</span><Badge variant="outline">{story + 1} / 3</Badge></div>
                <Progress value={((story + (stage >= STAGES.length ? 1 : Math.max(0, stage) / STAGES.length)) / 3) * 100} />
              </div>
            )}
            <TourAnchor id="q-map">
              <MapView className="h-[520px]" risk={risk} sites={sites} coverage={coverage} samples={samples} center={[80.8, 16.35]} zoom={8.3} />
            </TourAnchor>
            <p className="text-xs text-muted-foreground">Orange rings flashing = placements QAOA is sampling · orange posts = chosen · removed since last plan: {prevSel.filter((x) => !selection.includes(x)).map((x) => scenario?.candidates[x].name).join(", ") || "none"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Solver</CardTitle><CardDescription>ML risk → QUBO → QAOA → plan</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-5">
            <TourAnchor id="q-solver" className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as Method)} disabled={busy}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map((m) => <SelectItem key={m.id} value={m.id} disabled={m.id === "qaoa_ibm" && !online}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                {!online && <p className="text-xs text-muted-foreground">Recorded simulator runs (k = 6, p = 2, 4,096 shots). Set VITE_API_URL for live solves and IBM hardware.</p>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div><Label htmlFor="q-adapt">Local re-solve + warm start</Label><p className="text-xs text-muted-foreground">Reuse unchanged regions and previous angles</p></div>
                <Switch id="q-adapt" checked={adaptive} onCheckedChange={setAdaptive} disabled={busy} />
              </div>
            </TourAnchor>
            <Button onClick={() => scenario && void run(scenario, false)} disabled={busy || !scenario}><Play /> {running ? "Solving…" : "Solve"}</Button>
            <Separator />
            <TourAnchor id="q-pipeline"><PipelineStatus active={stage} quantumLabel={method === "qaoa_ibm" ? "IBM Heron QPU" : "simulator"} /></TourAnchor>
            {error && <Alert variant="destructive"><AlertTitle>Solve failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Risk-weighted coverage" value={result ? pct(result.coverage) : "—"} hint={result ? `exact optimum ${pct(result.exactCoverage)}` : ""} explain={{ what: "Share of risk-weighted grid cells within 11 km of a chosen post", source: "Objective evaluated on the prototype risk layer" }} />
        <Kpi label="Approximation ratio" value={result ? result.ratio.toFixed(3) : "—"} hint="vs exhaustive search" explain={{ what: "Coverage divided by the best possible coverage", source: "Exhaustive search over all 100,947 six-post plans" }} />
        <Kpi label="Feasible samples" value={meanFeasible !== null ? pct(meanFeasible) : "—"} hint="bitstrings with exactly k posts" explain={{ what: "Share of QAOA samples that pick exactly k posts", source: "4,096 shots per subproblem", meaning: "Compare with random sampling, shown per region below." }} />
        <Kpi label="Cost evaluations" value={regions.length ? evals.toLocaleString() : "—"} hint={regions.some((r) => r.warmStarted) ? "warm start (cold ≈ 2,400 per region)" : "cold start"} explain={{ what: "Classical optimiser calls of the quantum circuit", source: "COBYLA on CVaR(α = 0.2)" }} />
      </div>

      <TourAnchor id="q-tabs">
        <Tabs defaultValue="quantum">
          <TabsList>
            <TabsTrigger value="quantum">QAOA internals</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
          </TabsList>
          <TabsContent value="quantum" className="flex flex-col gap-4">
            {regions.length ? regions.map((r) => <RegionCard key={r.region} r={r} revealKey={revealKey} />) : <Skeleton className="h-64 w-full" />}
          </TabsContent>
          <TabsContent value="plan">
            {scenario && result ? <PlanTable scenario={scenario} selection={result.selection} previous={prevSel} /> : <Skeleton className="h-64 w-full" />}
          </TabsContent>
          <TabsContent value="benchmark">
            <BenchmarkPanel data={bench} loading={benchLoading} k={6} scenarioLabel={scenario?.label ?? ""}
              onRun={() => { setBenchLoading(true); void (async () => { try { setBench(!online && snapshot ? snapshot.benchmarks[sid] : await getBenchmark(sid, 6, online)) } catch (e) { setError(String(e)) } finally { setBenchLoading(false) } })() }} />
          </TabsContent>
        </Tabs>
      </TourAnchor>
    </>
  )
}
