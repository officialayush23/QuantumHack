import * as React from "react"

import { HOSPITALS } from "@/data/region"
import { remaining } from "@/lib/geo"
import { ENGINE_LABEL } from "@/lib/routing"
import { useWorld } from "@/store/world"
import type { IncidentF, PointF, RiskCellF, RouteF, ShelterF, SiteF, UnitF } from "./MapView"

export const hospitalsF: PointF[] = HOSPITALS.map((h) => ({ id: h.id, name: h.name, pos: h.pos }))

/** Everything the live world contributes to a map, memoised per slice so layers update independently. */
export function useWorldLayers() {
  const scenario = useWorld((s) => s.scenario)
  const placement = useWorld((s) => s.placement)
  const incidents = useWorld((s) => s.incidents)
  const units = useWorld((s) => s.units)
  const shelters = useWorld((s) => s.shelters)
  const closures = useWorld((s) => s.closures)

  const risk = React.useMemo<RiskCellF[]>(() => (scenario ? scenario.cells.map((c) => ({ ...c, dlon: scenario.grid.dlon, dlat: scenario.grid.dlat })) : []), [scenario])
  const sites = React.useMemo<SiteF[]>(() => {
    if (!scenario) return []
    const sel = new Set(placement?.selection ?? [])
    return scenario.candidates.map((c) => ({ id: c.id, name: c.name, pos: [c.lng, c.lat], selected: sel.has(c.id) }))
  }, [scenario, placement])
  const coverage = React.useMemo(() => {
    if (!scenario || !placement) return []
    return placement.selection.map((id) => ({ pos: [scenario.candidates[id].lng, scenario.candidates[id].lat] as [number, number], km: scenario.coverKm }))
  }, [scenario, placement])
  const incidentsF = React.useMemo<IncidentF[]>(() => incidents.map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, people: i.people, pos: i.pos, trust: i.trust, reports: i.reportIds.length })), [incidents])
  const unitsF = React.useMemo<UnitF[]>(() => units.map((u) => ({
    id: u.id, label: u.label, status: u.task?.kind === "staging" ? "staging" : u.status, pos: u.pos, agency: u.agency,
    task: u.task ? (u.task.kind === "incident" ? incidents.find((i) => i.id === u.task!.targetId)?.title : u.task.targetId.replace("site:", "staging at ")) : undefined,
    eta: u.task?.etaMin,
  })), [units, incidents])
  const routes = React.useMemo<RouteF[]>(() => units.filter((u) => u.task).map((u) => ({
    id: u.id, path: remaining(u.task!.path, u.task!.progressKm), kind: u.task!.kind, label: `${u.label} → ${u.task!.kind === "incident" ? incidents.find((i) => i.id === u.task!.targetId)?.title ?? "" : u.task!.targetId.replace("site:", "")}`,
    engine: ENGINE_LABEL[u.task!.engine], warn: u.task!.passesClosure,
  })), [units, incidents])
  const sheltersF = React.useMemo<ShelterF[]>(() => shelters.map((s) => ({ id: s.id, name: s.name, pos: s.pos, capacity: s.capacity, occupancy: s.occupancy })), [shelters])
  const closuresF = React.useMemo<PointF[]>(() => closures.map((c) => ({ id: c.id, name: c.reason, pos: c.pos, note: `reported by ${c.by}` })), [closures])

  return { risk, sites, coverage, incidents: incidentsF, units: unitsF, routes, shelters: sheltersF, closures: closuresF, hospitals: hospitalsF }
}

/** Advances the shared world clock. Mounted once at the root so every screen sees the same moment. */
export function useSimDriver() {
  const tick = useWorld((s) => s.tick)
  const init = useWorld((s) => s.init)
  React.useEffect(() => { void init() }, [init])
  React.useEffect(() => {
    const t = setInterval(() => tick(0.25), 250)
    return () => clearInterval(t)
  }, [tick])
}
