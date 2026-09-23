import { Atom, CloudRain, Route, Scale, ShieldCheck, Siren, UserRound, type LucideIcon } from "lucide-react"

import type { EventKind } from "@/store/types"

/** The agents that run the loop. Each owns a slice of the event log and has a fixed autonomy:
 *  what it may do on its own, and what it may only propose. The quantum planner is the one the
 *  others depend on: dispatch launches from its posts, routing starts from them, the gate only
 *  sees what dispatch could not cover from them. */

export type AgentId = "sentinel" | "quantum" | "triage" | "dispatch" | "routing" | "gate" | "human"

export interface AgentDef {
  id: AgentId
  name: string
  layer: "ML" | "Quantum" | "AI" | "Rules" | "People"
  icon: LucideIcon
  job: string
  inputs: string
  tools: string[]
  autonomy: string
  kinds: EventKind[]
}

export const AGENTS: AgentDef[] = [
  {
    id: "sentinel", name: "Forecast sentinel", layer: "ML", icon: CloudRain,
    job: "Turns river discharge, rainfall and terrain into a risk grid and decides when the risk state has changed enough to matter.",
    inputs: "GloFAS discharge, Open-Meteo rainfall, distance to Krishna / Budameru, low-lying ground",
    tools: ["get_river_discharge", "get_rainfall", "score_risk_grid", "request_quantum_resolve"],
    autonomy: "Acts alone: publishes the risk state and asks the planner to re-solve.",
    kinds: ["scenario"],
  },
  {
    id: "quantum", name: "Quantum planner", layer: "Quantum", icon: Atom,
    job: "Chooses the six staging posts that cover the most risk: builds the QUBO, splits it into ≤20-qubit regions, runs QAOA, reuses regions whose risk barely moved.",
    inputs: "Risk grid, 23 candidate towns, previous plan's parameters",
    tools: ["build_qubo", "split_regions", "run_qaoa(simulator | IBM Heron)", "decode_and_check_k", "stage_idle_units"],
    autonomy: "Acts alone: moves idle units to posts. Never touches a unit already on a job.",
    kinds: ["quantum"],
  },
  {
    id: "triage", name: "Triage agent", layer: "AI", icon: Siren,
    job: "Scores every report for trust, merges reports about the same place into one incident, holds bursts and copies.",
    inputs: "Citizen app, field crews, agencies, sensors",
    tools: ["score_trust", "cluster_reports", "open_incident", "hold_report"],
    autonomy: "Acts alone above the trust floor; below it, holds for a person.",
    kinds: ["report", "incident"],
  },
  {
    id: "dispatch", name: "Dispatch agent", layer: "AI", icon: Scale,
    job: "Assigns units to confirmed incidents by severity² × people and ETA, launching from the QAOA posts, and only re-tasks a moving unit when the new job clearly outweighs the old one.",
    inputs: "Confirmed incidents, unit positions at staging posts, closures",
    tools: ["rank_incidents", "eta_matrix", "assign_unit", "retask_with_switching_cost"],
    autonomy: "Acts alone for in-district units (rule D-1).",
    kinds: ["dispatch", "replan"],
  },
  {
    id: "routing", name: "Routing agent", layer: "AI", icon: Route,
    job: "Road routes that avoid reported closures, and re-routes every unit whose path runs through a new one.",
    inputs: "Closures from crews, Mapbox Directions, OSRM",
    tools: ["route(mapbox → osrm → straight)", "exclude_points", "reroute_affected"],
    autonomy: "Acts alone; labels every route with the engine that produced it.",
    kinds: ["closure"],
  },
  {
    id: "gate", name: "Delegation gate", layer: "Rules", icon: ShieldCheck,
    job: "Stops actions outside the delegation rules (outside teams, camp overflow) and names the officer who may approve.",
    inputs: "Proposed actions from dispatch and relief",
    tools: ["match_rule", "queue_for_officer"],
    autonomy: "Never acts alone. Exact rule match or a person decides.",
    kinds: ["approval"],
  },
  {
    id: "human", name: "People", layer: "People", icon: UserRound,
    job: "Field crews, officers and residents: on-scene updates, approvals, public alerts.",
    inputs: "Field app, citizen app, command console",
    tools: [],
    autonomy: "Final say.",
    kinds: ["field", "alert", "system"],
  },
]

export const AGENT_BY_KIND: Record<EventKind, AgentDef> = Object.fromEntries(
  AGENTS.flatMap((a) => a.kinds.map((k) => [k, a])),
) as Record<EventKind, AgentDef>

export const LAYER_TONE: Record<AgentDef["layer"], string> = {
  ML: "border-sky-500/40 text-sky-400",
  Quantum: "border-primary/60 text-primary",
  AI: "border-emerald-500/40 text-emerald-400",
  Rules: "border-amber-500/40 text-amber-400",
  People: "border-border text-muted-foreground",
}
