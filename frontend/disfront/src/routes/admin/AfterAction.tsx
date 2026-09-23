import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Download } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Kpi, PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { SHELTERS } from "@/data/region"
import { fmtMin } from "@/lib/geo"
import { SCENARIOS, pct, type Benchmark } from "@/lib/qadr"
import { clock, loadBenchmark, useWorld } from "@/store/world"


const cfg = {
  uniform: { label: "Uniform", color: "var(--muted-foreground)" },
  greedy: { label: "Greedy", color: "var(--chart-5)" },
  exact: { label: "Exact", color: "var(--chart-1)" },
  qaoa_sim: { label: "QAOA (sim)", color: "var(--chart-3)" },
} satisfies ChartConfig

export default function AfterAction() {
  const [bench, setBench] = React.useState<Record<string, Benchmark>>({})
  const incidents = useWorld((s) => s.incidents)
  const events = useWorld((s) => s.events)
  const units = useWorld((s) => s.units)
  const shelters = useWorld((s) => s.shelters)
  const ready = useWorld((s) => s.ready)
  React.useEffect(() => {
    if (!ready) return
    void Promise.all(SCENARIOS.map(async (s) => [s.id, await loadBenchmark(s.id)] as const)).then((rows) => setBench(Object.fromEntries(rows)))
  }, [ready])
  const data = SCENARIOS.filter((s) => bench[s.id]).map((s) => ({ scenario: s.short, uniform: bench[s.id].uniform.coverage, greedy: bench[s.id].greedy.coverage, exact: bench[s.id].exact.coverage, qaoa_sim: bench[s.id].qaoa_sim.coverage }))
  const resolved = incidents.filter((i) => i.resolvedAt !== undefined)
  const assignDelays = incidents.map((i) => events.find((e) => e.kind === "replan" && e.at >= i.createdAt && e.text.includes(i.title))?.at).map((at, k) => (at !== undefined ? at - incidents[k].createdAt : null)).filter((x): x is number => x !== null).sort((a, b) => a - b)
  const median = assignDelays.length ? assignDelays[Math.floor(assignDelays.length / 2)] : null
  const baseline = SHELTERS.reduce((a, s) => a + s.occupancy, 0)
  const sheltered = shelters.reduce((a, s) => a + s.occupancy, 0) - baseline

  const download = () => {
    const blob = new Blob([JSON.stringify({ events, incidents, units }, null, 2)], { type: "application/json" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "qadr-event-log.json"; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <PageHeader title="Benchmark & after-action" description="The evidence, in the running product rather than in a slide.">
        <Button size="sm" variant="outline" onClick={download}><Download /> Export event log</Button>
      </PageHeader>
      <TourAnchor id="aa-bench" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader><CardTitle>Staging-post coverage by method</CardTitle><CardDescription>Same instance and objective per risk state · k = 6 · recorded simulator runs</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={cfg} className="aspect-auto h-72 w-full">
              <BarChart data={data} margin={{ left: 4, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="scenario" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {(Object.keys(cfg) as (keyof typeof cfg)[]).map((k) => <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={3} />)}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Approximation ratio</CardTitle><CardDescription>Coverage ÷ exhaustive-search optimum</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>State</TableHead><TableHead className="text-right">Uniform</TableHead><TableHead className="text-right">Greedy</TableHead><TableHead className="text-right">QAOA</TableHead></TableRow></TableHeader>
              <TableBody>
                {SCENARIOS.filter((s) => bench[s.id]).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.short}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{bench[s.id].uniform.ratio.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{bench[s.id].greedy.ratio.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{bench[s.id].qaoa_sim.ratio.toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">QAOA is sampled per ≤20-qubit region, so part of the gap comes from the regional split and the pairwise QUBO, not the sampler. Classical solvers remain baseline and fallback.</p>
          </CardContent>
        </Card>
      </TourAnchor>
      <TourAnchor id="aa-outcome" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Incidents cleared" value={`${resolved.length}/${incidents.length}`} explain={{ what: "Incidents resolved in this session's event", source: "Event log" }} />
        <Kpi label="Median time to commit a unit" value={median !== null ? fmtMin(median) : "—"} explain={{ what: "From an incident opening to the re-plan that assigned it", source: "Event log" }} />
        <Kpi label="People evacuated" value={Math.max(0, sheltered)} explain={{ what: "Added to relief camps by cleared stranded incidents", source: "Camp occupancy" }} />
        <Kpi label="Event time" value={events.length ? clock(events[0].at) : "—"} explain={{ what: "Latest logged moment", source: "Event clock" }} />
      </TourAnchor>
      <TourAnchor id="aa-gaps">
        <Card size="sm">
          <CardHeader><CardTitle>Known gaps</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {[
              "Risk layer is rule-based (river distance, low-lying delta); the XGBoost model trained on Sentinel-1 flood extents is the next milestone.",
              "QAOA results shown here are recorded statevector-simulator runs. IBM hardware runs go through benchmark/run_ibm.py or the backend with an IBM Quantum account.",
              "In demo mode the world runs in the browser and is lost on reload; the FastAPI + Supabase backend makes it shared and durable.",
              "Dispatch in demo mode uses a greedy solver with the same objective and switching cost as the planned CP-SAT model.",
              "Facility and unit locations are approximate demo data.",
            ].map((g) => <p key={g}><Badge variant="outline" className="mr-2">gap</Badge>{g}</p>)}
          </CardContent>
        </Card>
      </TourAnchor>
      {data.length > 0 && <p className="text-xs text-muted-foreground">T0 QAOA coverage {pct(data[0].qaoa_sim)} vs optimum {pct(data[0].exact)}.</p>}
    </>
  )
}
