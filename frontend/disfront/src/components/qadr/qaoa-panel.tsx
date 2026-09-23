import * as React from "react"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Separator } from "@/components/ui/separator"
import { pct, type RegionResult } from "@/lib/qadr"

const traceConfig = {
  cvar: { label: "CVaR energy", color: "var(--chart-3)" },
  best: { label: "Best so far", color: "var(--chart-1)" },
} satisfies ChartConfig

const sampleConfig = {
  prob: { label: "Probability", color: "var(--chart-3)" },
} satisfies ChartConfig

function QuboHeatmap({ q }: { q: number[][] }) {
  const n = q.length
  const s = 18
  return (
    <svg viewBox={`0 0 ${n * s} ${n * s}`} className="w-full max-w-[220px]" role="img"
      aria-label={`${n} by ${n} QUBO matrix: orange diagonal rewards, grey off-diagonal penalties`}>
      {q.map((row, i) =>
        row.map((v, j) => {
          const a = Math.min(1, Math.abs(v) ** 0.6)
          const fill = i === j ? `color-mix(in oklch, var(--chart-3) ${Math.round(35 + 65 * a)}%, var(--muted))`
            : `color-mix(in oklch, var(--muted-foreground) ${Math.round(15 + 70 * a)}%, var(--muted))`
          return <rect key={`${i}-${j}`} x={j * s} y={i * s} width={s - 2} height={s - 2} rx={2} fill={fill} />
        })
      )}
    </svg>
  )
}

/** Reveals 0..total over `ms` each time `key` changes: replays the optimiser run on screen. */
function useReveal(total: number, key: number, ms = 2200) {
  const [n, setN] = React.useState(total)
  React.useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const f = Math.min(1, (t - t0) / ms)
      setN(Math.max(1, Math.round(f * total)))
      if (f < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [total, key, ms])
  return n
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

export function RegionCard({ r, revealKey }: { r: RegionResult; revealKey: number }) {
  const samples = r.topSamples.map((s) => ({ ...s, label: s.bits }))
  const shown = useReveal(r.trace.length, revealKey)
  const trace = r.trace.slice(0, shown)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{r.region} subproblem</CardTitle>
        <CardDescription>
          {r.qubits} problem qubits · choose {r.k} · p = {r.p} · {r.shots.toLocaleString()} shots
        </CardDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {r.status === "reused" && <Badge variant="secondary">Reused: risk unchanged</Badge>}
          {r.status === "hardware" && <Badge>IBM hardware</Badge>}
          {r.warmStarted && <Badge variant="outline">Warm start</Badge>}
          {r.foundOptimum ? <Badge variant="outline">Hit QUBO optimum</Badge> : <Badge variant="destructive">Missed optimum</Badge>}
          {r.zzTerms !== undefined && <Badge variant="outline">{r.zzTerms} ZZ terms / layer</Badge>}
          {r.twoQubitGates !== undefined && <Badge variant="outline">{r.twoQubitGates} 2q gates after transpile</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Feasible samples" value={pct(r.feasibleFrac)} hint={`random: ${pct(r.randomFeasibleFrac)}`} />
          <Stat label="Amplification" value={`${(r.feasibleFrac / r.randomFeasibleFrac).toFixed(1)}×`} hint="vs random sampling" />
          <Stat label="Cost evaluations" value={r.costEvals.toLocaleString()} hint={`${r.timeS.toFixed(1)} s`} />
          <Stat label="Best bitstring" value={r.bestBits ?? "none"} hint="q0 first" />
        </div>
        <Separator />
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr_auto]">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Optimiser convergence</span>
            <ChartContainer config={traceConfig} className="aspect-auto h-44 w-full">
              <LineChart data={trace} margin={{ left: 4, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="eval" type="number" domain={[0, r.trace.at(-1)?.eval ?? 1]} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="cvar" type="monotone" stroke="var(--color-cvar)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line dataKey="best" type="stepAfter" stroke="var(--color-best)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Most sampled bitstrings</span>
            <ChartContainer config={sampleConfig} className="aspect-auto h-44 w-full">
              <BarChart data={samples} margin={{ left: 4, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tick={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                <ChartTooltip content={<ChartTooltipContent labelKey="label" />} />
                <Bar dataKey="prob" radius={3} key={revealKey} animationDuration={1600}>
                  {samples.map((s) => (
                    <Cell key={s.bits} fill={s.optimal ? "var(--chart-1)" : s.feasible ? "var(--chart-3)" : "var(--muted-foreground)"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <span className="text-xs text-muted-foreground">Light: optimal · orange: feasible (exactly k sites) · grey: infeasible</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">QUBO matrix</span>
            <QuboHeatmap q={r.qubo} />
            <span className="text-xs text-muted-foreground">Diagonal: reward · off-diagonal: penalty</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
