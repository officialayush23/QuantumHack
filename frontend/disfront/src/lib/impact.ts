import { CATEGORY, SCENARIO_AT, SCRIPT, UNITS, type ScriptReport } from "@/data/region"
import { km, type LngLat } from "@/lib/geo"
import type { Benchmark, Scenario, ScenarioId, SolveResult } from "@/lib/qadr"

/** What the quantum plan buys, measured on the event's own life-safety calls.
 *
 *  For every stranded / medical / structure call in the event script we ask: how far is the nearest
 *  staging post of each plan, at the moment the call comes in (the plan in force for that risk
 *  state)? Drive time uses the same road-detour factor (×1.3) and road-towed boat speed (35 km/h)
 *  as dispatch. Nothing here is hand-entered: it is recomputed from the recorded solves.
 */

export type PlanKey = "home" | "uniform" | "greedy" | "exact" | "qaoa"

export const PLAN_LABEL: Record<PlanKey, string> = {
  home: "No pre-positioning (home stations)",
  uniform: "Uniform spacing",
  greedy: "Classical greedy",
  exact: "Exhaustive search (optimum)",
  qaoa: "QAOA plan (ours)",
}

export interface PlanImpact {
  key: PlanKey
  mean: number
  worst: number
  within20: number
  etas: number[]
}

export interface Impact {
  calls: { at: number; place: string; label: string }[]
  plans: Record<PlanKey, PlanImpact>
}

const SPEED = 35
const DETOUR = 1.3

const scenarioAt = (minute: number): ScenarioId => [...SCENARIO_AT].reverse().find((s) => minute >= s.at)!.id

/** Where life-safety crews wait without a plan: boat and rescue units at their home stations. */
const HOME_POSTS: LngLat[] = UNITS.filter((u) => u.capabilities.includes("boat") || u.capabilities.includes("rescue")).map((u) => u.home)

export function computeImpact(snap: { scenarios: Record<ScenarioId, Scenario>; solves: Record<ScenarioId, SolveResult>; benchmarks: Record<ScenarioId, Benchmark> }): Impact {
  const calls = SCRIPT.filter((x): x is { kind: "report" } & ScriptReport => x.kind === "report" && CATEGORY[x.category].lifeSafety)
  const posts = (plan: PlanKey, sid: ScenarioId): LngLat[] => {
    if (plan === "home") return HOME_POSTS
    const sc = snap.scenarios[sid]
    const sel = plan === "qaoa" ? snap.solves[sid].selection : snap.benchmarks[sid][plan].selection
    return sel.map((i) => [sc.candidates[i].lng, sc.candidates[i].lat] as LngLat)
  }
  const keys: PlanKey[] = ["home", "uniform", "greedy", "exact", "qaoa"]
  const plans = Object.fromEntries(keys.map((key) => {
    const etas = calls.map((c) => {
      const d = Math.min(...posts(key, scenarioAt(c.at)).map((p) => km(p, c.pos)))
      return ((d * DETOUR) / SPEED) * 60
    })
    return [key, {
      key, etas,
      mean: etas.reduce((a, b) => a + b, 0) / etas.length,
      worst: Math.max(...etas),
      within20: etas.filter((e) => e <= 20).length,
    }]
  })) as Record<PlanKey, PlanImpact>
  return { calls: calls.map((c) => ({ at: c.at, place: c.place, label: CATEGORY[c.category].label })), plans }
}
