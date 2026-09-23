import * as React from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Atom, Bot, CloudRain, Radio, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Explain } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { MapView } from "@/components/map/MapView"
import { useWorldLayers } from "@/components/map/layers"
import { AGENT_BY_KIND, LAYER_TONE } from "@/lib/agents"
import { fmtMin } from "@/lib/geo"
import { computeImpact, PLAN_LABEL, type PlanKey } from "@/lib/impact"
import { cn } from "@/lib/utils"
import { useCopilot } from "@/store/copilot"
import { clock, selectPending, useWorld } from "@/store/world"

/** The landing screen: the loop in one line, the map, and proof that the quantum layer is load-bearing. */
export default function Overview() {
  const L = useWorldLayers()
  const scenario = useWorld((s) => s.scenario)
  const minute = useWorld((s) => s.minute)
  const placement = useWorld((s) => s.placement)
  const planVersion = useWorld((s) => s.planVersion)
  const reports = useWorld((s) => s.reports.length)
  const incidents = useWorld((s) => s.incidents)
  const units = useWorld((s) => s.units)
  const events = useWorld((s) => s.events)
  const replans = useWorld((s) => s.replanCount)
  const stats = useWorld((s) => s.dispatchStats)
  const pending = useWorld((s) => selectPending(s).length)
  const snapshot = useWorld((s) => s.snapshot)
  const ask = useCopilot((s) => s.ask)

  const impact = React.useMemo(() => (snapshot ? computeImpact(snapshot) : null), [snapshot])
  const hot = scenario ? scenario.cells.filter((c) => c.level === "high" || c.level === "severe").length : 0
  const regions = placement?.regions ? Object.values(placement.regions) : []
  const staged = units.filter((u) => u.status === "staging" || u.task?.kind === "staging").length
  const open = incidents.filter((i) => i.status !== "resolved").length
  const agentEvents = events.filter((e) => e.kind !== "system").slice(0, 14)

  const LOOP = [
    { k: "Sense", icon: Radio, to: "/admin/feeds", tone: "", value: `${reports}`, unit: "reports", note: "citizens · crews · agencies · sensors + live river & rain" },
    { k: "Predict · ML", icon: CloudRain, to: "/admin/feeds", tone: "", value: `${hot}`, unit: "high-risk cells", note: scenario?.label ?? "loading" },
    { k: "Position · Quantum", icon: Atom, to: "/admin/quantum", tone: "border-primary bg-primary/10", value: placement ? `${(placement.coverage * 100).toFixed(1)}%` : "—", unit: "risk covered", note: `Plan v${planVersion} · ${regions.map((r) => `${r.qubits}q ${r.status === "reused" ? "reused" : r.warmStarted ? "warm" : "cold"}`).join(" + ") || "…"}` },
    { k: "Respond · Agents", icon: Bot, to: "/admin/agents", tone: "", value: `${stats.fromPost}/${stats.total}`, unit: "rescue dispatches from QAOA posts", note: `${replans} re-plans · ${pending} awaiting an officer` },
  ]

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Command overview</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            One loop. The model predicts where the flood will hurt, the quantum planner decides where crews wait before the calls come, and the agents dispatch, route and re-plan from those posts. When the risk moves, the loop runs again.
          </p>
        </div>
        <Button onClick={() => void ask("Give me a situation report")}><Sparkles /> Ask copilot</Button>
      </div>

      <TourAnchor id="o-loop" className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {LOOP.map((s, i) => (
          <Link key={s.k} to={s.to} className={cn("group relative flex flex-col gap-1 rounded-2xl border p-4 transition-colors hover:bg-muted/50", s.tone)}>
            <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <s.icon className={cn("size-4", s.tone && "text-primary")} /> {i + 1}. {s.k}
            </span>
            <span className="flex items-baseline gap-2"><span className="font-mono text-2xl font-semibold tabular-nums">{s.value}</span><span className="text-sm text-muted-foreground">{s.unit}</span></span>
            <span className="truncate text-xs text-muted-foreground">{s.note}</span>
            {i < LOOP.length - 1 && <ArrowRight className="absolute top-1/2 -right-3.5 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-background text-muted-foreground xl:block" />}
          </Link>
        ))}
      </TourAnchor>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <TourAnchor id="o-map" className="flex min-w-0 flex-col gap-2">
          <MapView className="h-[calc(100svh-330px)] min-h-[420px]"
            risk={L.risk} sites={L.sites} coverage={L.coverage} incidents={L.incidents} units={L.units}
            routes={L.routes} shelters={L.shelters} hospitals={L.hospitals} closures={L.closures} />
          <p className="text-xs text-muted-foreground">
            Orange posts and rings: the current QAOA plan. {staged} unit(s) at or moving to a post · {open} open incident(s) · {clock(minute)}
          </p>
        </TourAnchor>

        <div className="flex flex-col gap-4">
          <TourAnchor id="o-impact">
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">Why the quantum layer is there
                  <Explain what="Drive time from the nearest staging post to each life-safety call in the event" source="Recorded solves for each risk state; ×1.3 road detour at 35 km/h (road-towed boats), same as dispatch" meaning="Computed in the browser from the plans, not typed in." />
                </CardTitle>
                <CardDescription>Nearest crew to each of the event's {impact?.calls.length ?? "…"} life-safety calls</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {impact ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Stat label="From home stations" mean={impact.plans.home.mean} worst={impact.plans.home.worst} />
                      <Stat label="From QAOA posts" mean={impact.plans.qaoa.mean} worst={impact.plans.qaoa.worst} accent />
                    </div>
                    <ImpactBars plans={impact.plans} />
                    <p className="text-xs text-muted-foreground">Pre-positioning turns the delta calls from hours into minutes. Classical baselines are shown on purpose: at 23 sites no quantum speed-up is claimed; the planner re-solves in ~150 evaluations when the flood moves.</p>
                  </>
                ) : <p className="text-sm text-muted-foreground">Loading recorded solves…</p>}
              </CardContent>
            </Card>
          </TourAnchor>

          <TourAnchor id="o-agents">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Agent activity</CardTitle>
                <CardDescription>Who did what, and why, as it happens</CardDescription>
                <CardAction><Button asChild size="xs" variant="ghost"><Link to="/admin/agents">All agents</Link></Button></CardAction>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <ul className="flex flex-col gap-2 pr-3 text-xs">
                    {agentEvents.length === 0 && <li className="text-muted-foreground">Start the event to see the agents work.</li>}
                    {agentEvents.map((e) => {
                      const a = AGENT_BY_KIND[e.kind]
                      return (
                        <li key={e.id} className="flex gap-2">
                          <span className="w-14 shrink-0 font-mono text-muted-foreground tabular-nums">{clock(e.at)}</span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <Badge variant="outline" className={cn("w-fit gap-1", LAYER_TONE[a.layer])}><a.icon className="size-3" />{a.name}</Badge>
                            <span className="leading-snug">{e.text}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>
          </TourAnchor>

          <TourAnchor id="o-copilot">
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5"><Sparkles className="size-4 text-primary" /> Copilot</CardTitle>
                <CardDescription>Ask or instruct in plain words · ⌘K</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {["Why pre-position with quantum?", "What needs attention?", "Where is NDRF Boat 2?", "Fast-forward to the surge"].map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => void ask(s)}>{s}</Button>
                ))}
              </CardContent>
            </Card>
          </TourAnchor>
        </div>
      </div>
    </>
  )
}

function Stat({ label, mean, worst, accent }: { label: string; mean: number; worst: number; accent?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-xl border p-3", accent && "border-primary bg-primary/10")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums">{fmtMin(mean)}</span>
      <span className="text-xs text-muted-foreground">average · worst {fmtMin(worst)}</span>
    </div>
  )
}

function ImpactBars({ plans }: { plans: Record<PlanKey, { mean: number; worst: number }> }) {
  const keys: PlanKey[] = ["home", "uniform", "greedy", "exact", "qaoa"]
  const max = Math.max(...keys.map((k) => plans[k].worst))
  return (
    <div className="flex flex-col gap-1.5">
      {keys.map((k) => (
        <div key={k} className="grid grid-cols-[120px_1fr_52px] items-center gap-2 text-xs">
          <span className={cn("truncate", k === "qaoa" ? "font-medium text-foreground" : "text-muted-foreground")} title={PLAN_LABEL[k]}>{PLAN_LABEL[k].replace(" (home stations)", "").replace(" (optimum)", "")}</span>
          <div className="relative h-2.5 rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/30" style={{ width: `${(plans[k].worst / max) * 100}%` }} />
            <div className={cn("absolute inset-y-0 left-0 rounded-full", k === "qaoa" ? "bg-primary" : "bg-muted-foreground/70")} style={{ width: `${(plans[k].mean / max) * 100}%` }} />
          </div>
          <span className="text-right font-mono tabular-nums">{fmtMin(plans[k].mean)}</span>
        </div>
      ))}
      <span className="text-[11px] text-muted-foreground">Solid: average · faint: worst case</span>
    </div>
  )
}
