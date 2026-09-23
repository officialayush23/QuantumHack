import type { Capability, Category, Source } from "@/data/region"
import type { LngLat } from "@/lib/geo"
import type { RouteEngine, RouteStep } from "@/lib/routing"
import type { ScenarioId } from "@/lib/qadr"

export type UnitStatus = "available" | "staging" | "en_route" | "on_scene" | "offline"

export interface Task {
  kind: "incident" | "staging"
  targetId: string
  target: LngLat
  path: LngLat[]
  lengthKm: number
  progressKm: number
  engine: RouteEngine
  etaMin: number
  steps: RouteStep[]
  assignedAt: number
  reason: string
  /** true when the route could not avoid a reported closure (OSRM / straight line) */
  passesClosure?: boolean
  /** the QAOA staging post the unit was waiting at when it was dispatched */
  fromPost?: string
}

export interface Unit {
  id: string
  label: string
  agency: string
  capabilities: Capability[]
  speedKmh: number
  home: LngLat
  pos: LngLat
  crew: string
  status: UnitStatus
  task?: Task
  busyUntil?: number
  outsideDistrict?: boolean
  /** QAOA staging post the unit is currently waiting at */
  stagedAt?: string
}

export type IncidentStatus = "open" | "assigned" | "on_scene" | "resolved"

export interface Incident {
  id: string
  title: string
  category: Category
  severity: number
  people: number
  pos: LngLat
  place: string
  reportIds: string[]
  status: IncidentStatus
  trust: number
  createdAt: number
  resolvedAt?: number
  unitIds: string[]
}

export interface TrustParts {
  source: number
  history: number
  location: number
  corroboration: number
  evidence: number
  anomaly: number
}

export interface Report {
  id: string
  at: number
  source: Source
  category: Category
  people: number
  pos: LngLat
  place: string
  text: string
  photo: boolean
  reporter?: string
  trust: number
  parts: TrustParts
  decision: "opened" | "merged" | "held"
  incidentId?: string
  corroborators: number
}

export interface Shelter {
  id: string
  name: string
  pos: LngLat
  capacity: number
  occupancy: number
  overflowApproved?: boolean
}

export interface Closure {
  id: string
  pos: LngLat
  reason: string
  by: string
  at: number
}

export interface Approval {
  id: string
  at: number
  title: string
  detail: string
  rule: { id: string; text: string }
  status: "pending" | "approved" | "declined"
  decidedAt?: number
  kind: "outside_team" | "over_capacity"
  refId: string
}

export interface AlertMsg {
  id: string
  at: number
  title: string
  body: string
  area: string
  channels: ("sms" | "app" | "siren" | "radio")[]
  lang: "en" | "te" | "both"
}

export type EventKind = "report" | "incident" | "dispatch" | "replan" | "quantum" | "field" | "approval" | "alert" | "closure" | "system" | "scenario"

export interface WorldEvent {
  id: string
  at: number
  kind: EventKind
  text: string
  cause?: string
}

export interface PlanChange {
  unitId: string
  unitLabel: string
  change: "assigned" | "retasked" | "kept" | "staged"
  target: string
  reason: string
}

export interface CitizenReportInput {
  source: Source
  category: Category
  people: number
  pos: LngLat
  place: string
  text: string
  photo?: boolean
  reporter?: string
}

export type { ScenarioId }
