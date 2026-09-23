import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { pct, type Benchmark } from "@/lib/qadr"

const LABELS: Record<keyof Benchmark, string> = {
  uniform: "Uniform",
  greedy: "Greedy",
  exact: "Exact",
  qaoa_sim: "QAOA (sim)",
}
const config = { coverage: { label: "Risk-weighted coverage", color: "var(--chart-3)" } } satisfies ChartConfig

interface Props {
  data: Benchmark | null
  loading: boolean
  onRun: () => void
  k: number
  scenarioLabel: string
}

export function BenchmarkPanel({ data, loading, onRun, k, scenarioLabel }: Props) {
  const rows = data
    ? (Object.keys(LABELS) as (keyof Benchmark)[]).map((m) => ({ method: LABELS[m], id: m, ...data[m] }))
    : []
  return (
    <Card>
      <CardHeader>
        <CardTitle>Baselines vs QAOA</CardTitle>
        <CardDescription>
          Same instance and objective · {scenarioLabel} · k = {k}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : data ? (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 48 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="method" width={88} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="coverage" radius={4}>
                {rows.map((r) => (
                  <Cell key={r.id} fill={r.id === "qaoa_sim" ? "var(--chart-3)" : r.id === "exact" ? "var(--chart-1)" : "var(--muted-foreground)"} />
                ))}
                <LabelList dataKey="coverage" position="right" formatter={(v: unknown) => pct(Number(v))} className="fill-foreground font-mono text-xs" />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Run the benchmark to compare all four methods
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Coverage</TableHead>
              <TableHead className="text-right">Ratio</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.method}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{pct(r.coverage)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.ratio.toFixed(3)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.timeS < 0.01 ? "<0.01 s" : `${r.timeS.toFixed(2)} s`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Ratio = coverage / exact optimum. No quantum advantage is claimed at this size; classical solvers stay the baseline and fallback.
        </p>
        <Button variant="outline" onClick={onRun} disabled={loading}>
          {loading ? "Running…" : "Run benchmark"}
        </Button>
      </CardFooter>
    </Card>
  )
}
