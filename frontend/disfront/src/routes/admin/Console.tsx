import * as React from "react"
import { useShallow } from "zustand/react/shallow"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Kpi, SEVERITY_LABEL } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { MapView } from "@/components/map/MapView"
import { useWorldLayers } from "@/components/map/layers"
import { CATEGORY } from "@/data/region"
import { fmtMin } from "@/lib/geo"
import { clock, selectHeld, selectOpen, selectPending, selectUnattended, useWorld } from "@/store/world"


export default function Console() {
  const L = useWorldLayers()
  const [layers, setLayers] = React.useState({ risk: true, staging: true, routes: true })
  const [selected, setSelected] = React.useState<string | null>(null)
  const open = useWorld((s) => selectOpen(s).length)
  const unattended = useWorld((s) => selectUnattended(s).length)
  const pending = useWorld(useShallow(selectPending))
  const held = useWorld((s) => selectHeld(s).length)
  const units = useWorld((s) => s.units)
  const shelters = useWorld((s) => s.shelters)
  const changes = useWorld((s) => s.changes)
  const events = useWorld((s) => s.events)
  const incidents = useWorld((s) => s.incidents)
  const reports = useWorld((s) => s.reports)
  const lastReplanAt = useWorld((s) => s.lastReplanAt)
  const busy = units.filter((u) => u.status === "en_route" || u.status === "on_scene").length
  const full = shelters.filter((s) => s.occupancy / s.capacity >= 0.8).length
  const inc = incidents.find((i) => i.id === selected)

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-3">
        <TourAnchor id="c-map">
          <MapView className="h-[calc(100svh-230px)] min-h-[420px]"
            risk={layers.risk ? L.risk : []} sites={layers.staging ? L.sites : []} coverage={layers.staging ? L.coverage : []}
            incidents={L.incidents} units={L.units} routes={layers.routes ? L.routes : []} shelters={L.shelters} hospitals={L.hospitals} closures={L.closures}
            onPick={(kind, id) => kind === "incident" && setSelected(id)} />
        </TourAnchor>
        <TourAnchor id="c-layers" className="flex flex-wrap items-center gap-4 text-sm">
          {(["risk", "staging", "routes"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <Switch id={`lyr-${k}`} checked={layers[k]} onCheckedChange={(v) => setLayers((l) => ({ ...l, [k]: v }))} />
              <Label htmlFor={`lyr-${k}`}>{k === "risk" ? "Risk grid" : k === "staging" ? "QAOA staging posts" : "Routes"}</Label>
            </div>
          ))}
          <span className="text-xs text-muted-foreground">Unit colours: green available · teal moving to staging · amber en route · orange on scene · grey out of service</span>
        </TourAnchor>
      </div>

      <div className="flex flex-col gap-4">
        <TourAnchor id="c-kpi" className="grid grid-cols-2 gap-3">
          <Kpi label="Open incidents" value={open} explain={{ what: "Incidents not yet resolved", source: "Clustered citizen, field, agency and sensor reports", meaning: "Several reports about one place become one incident." }} />
          <Kpi label="Nobody on the way" value={unattended} tone={unattended ? "bad" : "good"} explain={{ what: "Confirmed or pending incidents with no unit assigned", source: "Dispatch plan", meaning: "Should be zero unless units are exhausted or approval is pending." }} />
          <Kpi label="Units in use" value={`${busy}/${units.length}`} explain={{ what: "Units en route or on scene", source: "Unit status from the field app" }} />
          <Kpi label="Camps ≥ 80% full" value={full} tone={full ? "warn" : "default"} explain={{ what: "Relief camps at or above 80% of rated capacity", source: "Camp occupancy after evacuations" }} />
        </TourAnchor>

        {inc && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>{inc.title}</CardTitle>
              <CardDescription>{SEVERITY_LABEL[inc.severity]} · {inc.people} people · {inc.status.replace("_", " ")} · opened {clock(inc.createdAt)}</CardDescription>
              <CardAction><Button size="xs" variant="ghost" onClick={() => setSelected(null)}>Close</Button></CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>Needs: {CATEGORY[inc.category].needs} · trust {inc.trust.toFixed(2)} from {inc.reportIds.length} report(s)</p>
              {inc.unitIds.map((id) => {
                const u = units.find((x) => x.id === id)
                return u ? <p key={id} className="text-muted-foreground">{u.label}: {u.status.replace("_", " ")}{u.task ? `, ETA ${fmtMin(u.task.etaMin)}` : ""}</p> : null
              })}
              {reports.filter((r) => r.incidentId === inc.id).slice(0, 3).map((r) => (
                <p key={r.id} className="text-xs text-muted-foreground">“{r.text}” · {r.source}</p>
              ))}
            </CardContent>
          </Card>
        )}

        <TourAnchor id="c-needs">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Needs you</CardTitle>
              <CardDescription>Only what is waiting for a person</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {pending.length === 0 && held === 0 && <p className="text-muted-foreground">Nothing is waiting. The system is acting within its delegation rules.</p>}
              {pending.slice(0, 3).map((a) => (
                <Link key={a.id} to="/admin/approvals" className="flex items-center justify-between gap-2 rounded-lg border p-2 hover:bg-muted">
                  <span>{a.title}</span><Badge>{a.rule.id}</Badge>
                </Link>
              ))}
              {held > 0 && <Link to="/admin/reports" className="rounded-lg border p-2 hover:bg-muted">{held} report(s) held below the trust floor</Link>}
            </CardContent>
          </Card>
        </TourAnchor>

        <TourAnchor id="c-changes">
          <Card size="sm">
            <CardHeader>
              <CardTitle>What the last re-plan changed</CardTitle>
              <CardDescription>{lastReplanAt === null ? "No re-plan yet" : `At ${clock(lastReplanAt)}`}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <ul className="flex flex-col gap-2 pr-3 text-sm">
                  {changes.length === 0 && <li className="text-muted-foreground">{lastReplanAt === null ? "Start the event to see the plan form." : "Nothing changed at the last re-plan: every unit kept its job."}</li>}
                  {changes.slice(0, 20).map((c, i) => (
                    <li key={i} className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <Badge variant={c.change === "kept" ? "outline" : c.change === "staged" ? "secondary" : "default"}>{c.change}</Badge>
                        <span className="font-medium">{c.unitLabel}</span> → {c.target}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.reason}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </TourAnchor>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Event log</CardTitle>
            <CardDescription>Append-only; every line names what caused it</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-56">
              <ul className="flex flex-col gap-1.5 pr-3 text-xs">
                {events.slice(0, 60).map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="shrink-0 font-mono text-muted-foreground tabular-nums">{clock(e.at)}</span>
                    <Badge variant="outline" className="shrink-0">{e.kind}</Badge>
                    <span>{e.text}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
