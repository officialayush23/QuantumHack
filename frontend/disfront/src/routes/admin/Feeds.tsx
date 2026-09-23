import * as React from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"


const POINTS = [
  { id: "barrage", name: "Krishna at Prakasam Barrage", lat: 16.506, lng: 80.605 },
  { id: "delta", name: "Krishna delta near Avanigadda", lat: 16.02, lng: 80.93 },
]

interface Flood { date: string; discharge: number | null; max: number | null }
interface Rain { time: string; mm: number; prob: number | null }

const flowCfg = { discharge: { label: "Discharge (m³/s)", color: "var(--chart-3)" } } satisfies ChartConfig
const rainCfg = { mm: { label: "Rain (mm/h)", color: "var(--chart-2)" } } satisfies ChartConfig

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`)
  return r.json() as Promise<T>
}

export default function Feeds() {
  const [flood, setFlood] = React.useState<Record<string, Flood[]>>({})
  const [rain, setRain] = React.useState<Rain[]>([])
  const [at, setAt] = React.useState<Date | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const floods = await Promise.all(POINTS.map((p) => getJSON<{ daily: { time: string[]; river_discharge: (number | null)[]; river_discharge_max: (number | null)[] } }>(
        `https://flood-api.open-meteo.com/v1/flood?latitude=${p.lat}&longitude=${p.lng}&daily=river_discharge,river_discharge_max&past_days=30&forecast_days=30`)))
      const f: Record<string, Flood[]> = {}
      floods.forEach((d, i) => { f[POINTS[i].id] = d.daily.time.map((t, j) => ({ date: t.slice(5), discharge: d.daily.river_discharge[j], max: d.daily.river_discharge_max[j] })) })
      const w = await getJSON<{ hourly: { time: string[]; precipitation: number[]; precipitation_probability: (number | null)[] } }>(
        "https://api.open-meteo.com/v1/forecast?latitude=16.506&longitude=80.648&hourly=precipitation,precipitation_probability&past_days=2&forecast_days=3&timezone=Asia%2FKolkata")
      setFlood(f)
      setRain(w.hourly.time.map((t, i) => ({ time: t.slice(5, 13).replace("T", " "), mm: w.hourly.precipitation[i], prob: w.hourly.precipitation_probability[i] })))
      setAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
  React.useEffect(() => { void load() }, [load])
  const today = new Date().toISOString().slice(5, 10)

  return (
    <>
      <PageHeader title="Live river & rain" description="Real, current observations and forecasts for the basin. These feed the risk model in the backend; the simulated event on the live map is separate.">
        <Badge variant="outline">{at ? `Fetched ${at.toLocaleTimeString()}` : "Not fetched yet"}</Badge>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw /> Refresh</Button>
      </PageHeader>
      {error && <Alert variant="destructive"><AlertTitle>Feed unavailable</AlertTitle><AlertDescription>{error}. Showing the last copy if there is one: check the fetch time before acting on it.</AlertDescription></Alert>}
      <TourAnchor id="f-river" className="grid gap-5 lg:grid-cols-2">
        {POINTS.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>GloFAS v4 via Open-Meteo Flood API · daily mean discharge</CardDescription>
              <CardAction><Badge variant="secondary">{p.lat.toFixed(2)}, {p.lng.toFixed(2)}</Badge></CardAction>
            </CardHeader>
            <CardContent>
              {flood[p.id] ? (
                <ChartContainer config={flowCfg} className="aspect-auto h-56 w-full">
                  <AreaChart data={flood[p.id]} margin={{ left: 4, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis tickLine={false} axisLine={false} width={52} />
                    <ReferenceLine x={today} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: "today", fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area dataKey="discharge" type="monotone" stroke="var(--color-discharge)" fill="var(--color-discharge)" fillOpacity={0.25} />
                  </AreaChart>
                </ChartContainer>
              ) : <Skeleton className="h-56 w-full" />}
            </CardContent>
          </Card>
        ))}
      </TourAnchor>
      <TourAnchor id="f-rain">
        <Card>
          <CardHeader><CardTitle>Rainfall, Vijayawada</CardTitle><CardDescription>Open-Meteo forecast API · hourly, past 2 days and next 3</CardDescription></CardHeader>
          <CardContent>
            {rain.length ? (
              <ChartContainer config={rainCfg} className="aspect-auto h-56 w-full">
                <BarChart data={rain} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="mm" fill="var(--color-mm)" radius={2} />
                </BarChart>
              </ChartContainer>
            ) : <Skeleton className="h-56 w-full" />}
          </CardContent>
        </Card>
      </TourAnchor>
    </>
  )
}
