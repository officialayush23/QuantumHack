import * as React from "react"
import { useShallow } from "zustand/react/shallow"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { MapView } from "@/components/map/MapView"
import { useWorldLayers } from "@/components/map/layers"
import { CAPABILITY_LABEL, CATEGORY } from "@/data/region"
import { fmtKm, fmtMin, remaining } from "@/lib/geo"
import { ENGINE_LABEL } from "@/lib/routing"
import { clock, selectOpenUnassigned, useWorld } from "@/store/world"


export default function Dispatch() {
  const units = useWorld((s) => s.units)
  const incidents = useWorld((s) => s.incidents)
  const approvals = useWorld((s) => s.approvals)
  const unattended = useWorld(useShallow(selectOpenUnassigned))
  const L = useWorldLayers()
  const [sel, setSel] = React.useState<string | null>(null)
  const active = units.filter((u) => u.task)
  const su = units.find((u) => u.id === sel)

  return (
    <>
      <PageHeader title="Who is on what" description="The solver's current assignments, with the reason for each one. Re-planning happens automatically on every new report, closure or status change." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-5">
          <TourAnchor id="d-ledger">
            <Card>
              <CardHeader><CardTitle>Units on a job</CardTitle><CardDescription>{active.length} of {units.length} units moving</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead><TableHead>Going to</TableHead><TableHead>Why this unit</TableHead><TableHead className="text-right">ETA</TableHead><TableHead>Route</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No unit is moving. Start the event from the clock above.</TableCell></TableRow>}
                    {active.map((u) => {
                      const inc = incidents.find((i) => i.id === u.task!.targetId)
                      return (
                        <TableRow key={u.id} onClick={() => setSel(u.id)} className="cursor-pointer" data-state={sel === u.id ? "selected" : undefined}>
                          <TableCell className="font-medium">{u.label}<div className="text-xs text-muted-foreground">{u.agency}</div></TableCell>
                          <TableCell>{u.task!.kind === "staging" ? <Badge variant="secondary">Staging</Badge> : null} {inc?.title ?? u.task!.targetId.replace("site:", "")}</TableCell>
                          <TableCell className="max-w-72 text-xs text-muted-foreground whitespace-normal">{u.task!.reason}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{fmtMin(u.task!.etaMin)}</TableCell>
                          <TableCell>
                            <Badge variant={u.task!.engine === "mapbox" ? "outline" : "secondary"}>{u.task!.engine}</Badge>
                            {u.task!.passesClosure && <Badge variant="destructive" className="ml-1">passes closure</Badge>}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TourAnchor>

          <TourAnchor id="d-uncovered">
            <Card>
              <CardHeader><CardTitle>Demands nobody has</CardTitle><CardDescription>{unattended.length} incident(s) without a unit</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {unattended.length === 0 && <p className="text-muted-foreground">Every open incident has a unit on the way.</p>}
                {unattended.map((i) => {
                  const need = CATEGORY[i.category].needs
                  const wait = approvals.find((a) => a.refId === i.id && a.status === "pending")
                  const free = units.some((u) => u.capabilities.includes(need) && (u.status === "available" || u.status === "staging"))
                  const reason = wait ? `waiting for approval (${wait.rule.id})` : i.trust < 0.35 ? "held below the trust floor" : !free ? `no free ${CAPABILITY_LABEL[need].toLowerCase()}` : "needs corroboration before a vehicle is spent"
                  return (
                    <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                      <span>{i.title} <span className="text-muted-foreground">· since {clock(i.createdAt)}</span></span>
                      <Badge variant="outline">{reason}</Badge>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TourAnchor>
        </div>

        <TourAnchor id="d-route" className="flex flex-col gap-4">
          <MapView className="h-80" units={L.units} incidents={L.incidents} closures={L.closures} routes={L.routes.filter((r) => !sel || r.id === sel)}
            highlight={su?.task ? remaining(su.task.path, su.task.progressKm) : undefined}
            fit={su?.task ? { key: su.id + su.task.assignedAt, points: su.task.path } : undefined} onPick={(k, id) => k === "unit" && setSel(id)} />
          <Card size="sm">
            <CardHeader>
              <CardTitle>{su ? su.label : "Select a unit"}</CardTitle>
              <CardDescription>{su?.task ? `${fmtKm(su.task.lengthKm - su.task.progressKm)} to go · ${ENGINE_LABEL[su.task.engine]}` : "Click a row or a unit on the map"}</CardDescription>
            </CardHeader>
            {su?.task && (
              <CardContent>
                <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
                  {su.task.steps.slice(0, 12).map((s, i) => <li key={i}>{s.instruction} <span className="text-muted-foreground">({fmtKm(s.distanceKm)})</span></li>)}
                </ol>
              </CardContent>
            )}
          </Card>
        </TourAnchor>
      </div>
    </>
  )
}
