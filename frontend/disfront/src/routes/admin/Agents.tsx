import * as React from "react"
import { Atom, Link2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { AGENTS, AGENT_BY_KIND, LAYER_TONE, type AgentId } from "@/lib/agents"
import { cn } from "@/lib/utils"
import { clock, useWorld } from "@/store/world"

/** The agents, what each may do on its own, and the trace of everything they did. */
export default function Agents() {
  const events = useWorld((s) => s.events)
  const reports = useWorld((s) => s.reports)
  const placement = useWorld((s) => s.placement)
  const prev = useWorld((s) => s.prevPlacement)
  const scenario = useWorld((s) => s.scenario)
  const planVersion = useWorld((s) => s.planVersion)
  const stats = useWorld((s) => s.dispatchStats)
  const [filter, setFilter] = React.useState<AgentId | "all">("all")
  const [picked, setPicked] = React.useState<string | null>(null)

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {}
    events.forEach((e) => { const a = AGENT_BY_KIND[e.kind].id; c[a] = (c[a] ?? 0) + 1 })
    return c
  }, [events])
  const shown = events.filter((e) => filter === "all" || AGENT_BY_KIND[e.kind].id === filter).slice(0, 150)
  const ev = events.find((e) => e.id === picked)
  const causeReport = ev?.cause ? reports.find((r) => r.id === ev.cause) : undefined
  const causeEvent = ev?.cause ? events.find((e) => e.id === ev.cause) : undefined

  const regions = placement?.regions ? Object.values(placement.regions) : []
  const prevSel = new Set(prev?.selection ?? [])
  const curSel = new Set(placement?.selection ?? [])
  const added = placement && scenario ? placement.selection.filter((i) => !prevSel.has(i)).map((i) => scenario.candidates[i].name) : []
  const dropped = prev && scenario ? prev.selection.filter((i) => !curSel.has(i)).map((i) => scenario.candidates[i]?.name) : []

  return (
    <>
      <PageHeader title="Agents" description="Six agents run the loop; people keep the final say. The quantum planner sits in the middle: dispatch launches from its posts, routing starts from them, and the gate only sees what could not be covered from them." />

      <TourAnchor id="ag-roster" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((a) => (
          <button key={a.id} type="button" onClick={() => setFilter(filter === a.id ? "all" : a.id)} className="text-left">
            <Card size="sm" className={cn("h-full transition-colors hover:bg-muted/40", a.layer === "Quantum" && "border-primary bg-primary/5", filter === a.id && "ring-2 ring-primary")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><a.icon className={cn("size-4", a.layer === "Quantum" && "text-primary")} />{a.name}
                  <Badge variant="outline" className={cn("ml-auto", LAYER_TONE[a.layer])}>{a.layer}</Badge>
                </CardTitle>
                <CardDescription>{a.job}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs">
                <p><span className="text-muted-foreground">Reads:</span> {a.inputs}</p>
                {a.tools.length > 0 && <div className="flex flex-wrap gap-1">{a.tools.map((t) => <Badge key={t} variant="secondary" className="font-mono text-[10px]">{t}</Badge>)}</div>}
                <p><span className="text-muted-foreground">Autonomy:</span> {a.autonomy}</p>
                <p className="font-mono text-muted-foreground tabular-nums">{counts[a.id] ?? 0} action(s) this event</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </TourAnchor>

      <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <TourAnchor id="ag-policy">
            <Card size="sm" className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Atom className="size-4 text-primary" /> Planner's last decision</CardTitle>
                <CardDescription>Plan v{planVersion} · {scenario?.label ?? "…"}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {regions.map((r) => (
                  <div key={r.region} className="flex flex-col gap-0.5 rounded-lg border p-2">
                    <span className="flex items-center justify-between"><span className="font-medium capitalize">{r.region} region · {r.qubits} qubits</span>
                      <Badge variant={r.status === "reused" ? "outline" : "default"}>{r.status === "reused" ? "reused" : r.warmStarted ? "warm start" : "cold start"}</Badge></span>
                    <span className="text-xs text-muted-foreground">
                      {r.status === "reused"
                        ? "Risk mass moved less than 10%: last plan's posts kept, no quantum run spent."
                        : `${r.costEvals} cost evaluations${r.warmStarted ? ", starting from the previous plan's angles" : ", 8 random starts"} · feasible samples ${(r.feasibleFrac * 100).toFixed(0)}% vs ${(r.randomFeasibleFrac * 100).toFixed(0)}% by chance`}
                    </span>
                  </div>
                ))}
                {prev && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Changed posts:</span>{" "}
                    {added.length ? <>+ {added.join(", ")}</> : "none added"}{dropped.length ? <> · − {dropped.join(", ")}</> : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Policy: re-solve only the regions whose risk mass changed ≥ 10%; warm-start from the last angles; send to IBM hardware when a QPU is configured, otherwise the simulator.</p>
                <p className="text-xs"><span className="font-mono tabular-nums">{stats.fromPost}</span> of <span className="font-mono tabular-nums">{stats.total}</span> boat and rescue dispatches so far left from a QAOA post.</p>
              </CardContent>
            </Card>
          </TourAnchor>

          {ev && (
            <Card size="sm">
              <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-4" /> Why this happened</CardTitle><CardDescription>{clock(ev.at)} · {AGENT_BY_KIND[ev.kind].name}</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>{ev.text}</p>
                {causeReport && <p className="rounded-lg border p-2 text-xs">Caused by report {causeReport.id} ({causeReport.source}, trust {causeReport.trust.toFixed(2)}): “{causeReport.text}”</p>}
                {causeEvent && <p className="rounded-lg border p-2 text-xs">Caused by: {causeEvent.text}</p>}
                {ev.cause && !causeReport && !causeEvent && <p className="rounded-lg border p-2 text-xs">Triggered by: {ev.cause}</p>}
                {!ev.cause && <p className="text-xs text-muted-foreground">No upstream cause recorded: this was a direct trigger.</p>}
                <Button size="xs" variant="ghost" className="self-start" onClick={() => setPicked(null)}>Close</Button>
              </CardContent>
            </Card>
          )}
        </div>

        <TourAnchor id="ag-trace">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Decision trace</CardTitle>
              <CardDescription>{filter === "all" ? "Every agent" : AGENTS.find((a) => a.id === filter)?.name} · click a line to see what caused it</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[560px]">
                <ul className="flex flex-col pr-3 text-sm">
                  {shown.length === 0 && <li className="py-2 text-muted-foreground">Nothing yet. Start the event from the clock above.</li>}
                  {shown.map((e) => {
                    const a = AGENT_BY_KIND[e.kind]
                    return (
                      <li key={e.id}>
                        <button type="button" onClick={() => setPicked(e.id)} className={cn("flex w-full gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted", picked === e.id && "bg-muted")}>
                          <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{clock(e.at)}</span>
                          <Badge variant="outline" className={cn("h-fit shrink-0 gap-1", LAYER_TONE[a.layer])}><a.icon className="size-3" />{a.name}</Badge>
                          <span className="leading-snug">{e.text}{e.cause && <Link2 className="ml-1 inline size-3 text-muted-foreground" />}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </TourAnchor>
      </div>
    </>
  )
}
