import { CATEGORY, SCRIPT, SHELTERS, type ScriptReport } from "@/data/region"
import { fmtMin, km, type LngLat } from "@/lib/geo"
import { computeImpact, PLAN_LABEL, type PlanKey } from "@/lib/impact"
import type { ScenarioId } from "@/lib/qadr"
import { clock, confirmed, selectHeld, selectPending, useWorld } from "@/store/world"
import type { Unit } from "@/store/types"

/** Copilot: answers questions and takes actions over the live plan.
 *
 *  Every answer is produced by calling the same store functions the screens use, and the reply
 *  lists those calls, so an operator can see exactly what was read or changed. In demo mode the
 *  question is matched to a tool on-device (no model, no network); with the backend, an LLM picks
 *  the tool from the same list. Actions that commit resources (outside teams, overflow) still go
 *  to the delegation gate: the copilot cannot approve anything.
 */

export interface Reply {
  text: string
  tools: string[]
  head?: string[]
  rows?: (string | number)[][]
  links?: { label: string; to: string }[]
  acted?: boolean
}

export const SUGGESTIONS = [
  "Give me a situation report",
  "Where are the QAOA staging posts?",
  "Why pre-position with quantum?",
  "What needs attention?",
  "Where is NDRF Boat 2?",
  "Fast-forward to the surge",
  "Block the road at Kankipadu",
  "Which relief camps are filling up?",
]

const W = () => useWorld.getState()
const wt = (sev: number, people: number) => sev ** 2 * (1 + people / 50)
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

function findUnit(q: string, units: Unit[]): Unit | undefined {
  const direct = units.find((u) => q.includes(u.label.toLowerCase()) || q.includes(u.id.toLowerCase()))
  if (direct) return direct
  const m = q.match(/(boat|ambulance|amb|pump|truck|fire)\s*#?(\d)/)
  if (!m) return undefined
  const word = m[1] === "amb" ? "ambulance" : m[1]
  return units.find((u) => u.label.toLowerCase().includes(word) && u.label.endsWith(` ${m[2]}`))
}

function places(): { name: string; pos: LngLat }[] {
  const s = W().scenario
  const out: { name: string; pos: LngLat }[] = []
  s?.candidates.forEach((c) => out.push({ name: c.name, pos: [c.lng, c.lat] }))
  SCRIPT.forEach((x) => { if (x.kind === "report") out.push({ name: (x as ScriptReport).place, pos: (x as ScriptReport).pos }) })
  SHELTERS.forEach((x) => out.push({ name: x.name, pos: x.pos }))
  return out.sort((a, b) => b.name.length - a.name.length)
}

function unitLine(u: Unit) {
  const w = W()
  const where = u.task
    ? u.task.kind === "incident"
      ? `en route to ${w.incidents.find((i) => i.id === u.task!.targetId)?.title ?? "an incident"}, ETA ${fmtMin(u.task.etaMin)}`
      : `moving to QAOA post ${u.task.targetId.replace("site:", "")}, ETA ${fmtMin(u.task.etaMin)}`
    : u.status === "staging" ? `waiting at QAOA post ${u.stagedAt ?? ""}` : u.status.replace("_", " ")
  return where
}

export function situation(): Reply {
  const w = W()
  const open = w.incidents.filter((i) => i.status !== "resolved")
  const nobody = open.filter((i) => i.status === "open")
  const busy = w.units.filter((u) => u.status === "en_route" || u.status === "on_scene").length
  const staged = w.units.filter((u) => u.status === "staging").length
  const p = w.placement
  const sites = p && w.scenario ? p.selection.map((i) => w.scenario!.candidates[i].name).join(", ") : "—"
  return {
    text: `${clock(w.minute)} · ${w.scenario?.label ?? "loading"}. ${open.length} open incident(s), ${nobody.length} with nobody on the way. ${busy} of ${w.units.length} units on jobs, ${staged} waiting at QAOA posts (${sites}). Plan v${w.planVersion} covers ${p ? pct(p.coverage) : "—"} of risk-weighted exposure. ${selectPending(w).length} approval(s) waiting, ${selectHeld(w).length} report(s) held.`,
    tools: ["get_situation()", "get_quantum_plan()"],
    links: [{ label: "Open overview", to: "/admin/overview" }],
  }
}

function quantumPlan(): Reply {
  const w = W()
  const p = w.placement
  const sc = w.scenario
  if (!p || !sc) return { text: "No plan yet: the event has not loaded.", tools: ["get_quantum_plan()"] }
  const regions = p.regions ? Object.values(p.regions) : []
  return {
    text: `Plan v${w.planVersion} for "${sc.label}": QAOA picked ${p.selection.length} posts covering ${pct(p.coverage)} of risk-weighted exposure (${p.ratio.toFixed(3)} of the exhaustive-search optimum). ${regions.map((r) => `${r.region} region: ${r.qubits} qubits, ${r.status === "reused" ? "reused from last plan" : r.warmStarted ? `warm start, ${r.costEvals} evaluations` : `cold start, ${r.costEvals} evaluations`}`).join("; ")}.`,
    tools: ["get_quantum_plan()"],
    head: ["Post", "Region", "Unit waiting"],
    rows: p.selection.map((i) => {
      const c = sc.candidates[i]
      const u = w.units.find((x) => x.stagedAt === c.name && x.status === "staging") ?? w.units.find((x) => x.task?.targetId === `site:${c.name}`)
      return [c.name, c.region, u ? `${u.label}${u.task ? " (on the way)" : ""}` : "—"]
    }),
    links: [{ label: "Open quantum planner", to: "/admin/quantum" }],
  }
}

function impact(): Reply {
  const snap = W().snapshot
  if (!snap) return { text: "The recorded solves are not loaded yet.", tools: ["compare_plans()"] }
  const im = computeImpact(snap)
  const q = im.plans.qaoa
  const h = im.plans.home
  const keys: PlanKey[] = ["home", "uniform", "greedy", "exact", "qaoa"]
  return {
    text: `On the event's ${im.calls.length} life-safety calls, crews waiting at the QAOA posts are on average ${fmtMin(q.mean)} away (worst ${fmtMin(q.worst)}), against ${fmtMin(h.mean)} (worst ${fmtMin(h.worst)}) from home stations. Pre-positioning is what cuts the delta calls from hours to minutes; QAOA is how the posts are chosen, re-solved as the flood moves. Classical baselines are listed alongside: no quantum advantage is claimed at this size.`,
    tools: ["compare_plans(calls=life_safety)"],
    head: ["Plan", "Mean", "Worst", "≤ 20 min"],
    rows: keys.map((k) => [PLAN_LABEL[k], fmtMin(im.plans[k].mean), fmtMin(im.plans[k].worst), `${im.plans[k].within20}/${im.calls.length}`]),
    links: [{ label: "Open impact & benchmark", to: "/admin/after-action" }],
  }
}

function attention(): Reply {
  const w = W()
  const nobody = w.incidents.filter((i) => i.status === "open")
  const pend = selectPending(w)
  const held = selectHeld(w)
  if (!nobody.length && !pend.length && !held.length) return { text: "Nothing is waiting for a person. Every confirmed incident has a unit and no approval is pending.", tools: ["list_unattended()", "list_approvals(status=pending)"] }
  return {
    text: `${nobody.length} incident(s) with nobody on the way, ${pend.length} approval(s) waiting, ${held.length} report(s) held below the trust floor.`,
    tools: ["list_unattended()", "list_approvals(status=pending)", "list_reports(decision=held)"],
    head: ["Item", "Why"],
    rows: [
      ...nobody.slice(0, 5).map((i) => [i.title, confirmed(i.trust, i.category, "citizen") ? `no free ${CATEGORY[i.category].needs} unit within reach` : `waiting for corroboration (trust ${i.trust.toFixed(2)})`]),
      ...pend.slice(0, 3).map((a) => [a.title, `${a.rule.id}: ${a.rule.text}`]),
      ...(held.length ? [[`${held.length} held report(s)`, "below the trust floor or flagged as a burst"]] : []),
    ],
    links: [...(pend.length ? [{ label: "Approvals", to: "/admin/approvals" }] : []), { label: "Who is on what", to: "/admin/dispatch" }],
  }
}

function incidents(): Reply {
  const w = W()
  const open = w.incidents.filter((i) => i.status !== "resolved").sort((a, b) => wt(b.severity, b.people) - wt(a.severity, a.people))
  if (!open.length) return { text: "No open incidents.", tools: ["list_incidents(status=open)"] }
  return {
    text: `${open.length} open incident(s), in the order help is sent (severity² × people):`,
    tools: ["list_incidents(status=open, sort=priority)"],
    head: ["Incident", "Sev", "People", "Unit"],
    rows: open.slice(0, 6).map((i) => [i.title, i.severity, i.people, i.unitIds.map((id) => w.units.find((u) => u.id === id)?.label).filter(Boolean).join(", ") || "none"]),
    links: [{ label: "Incidents", to: "/admin/incidents" }],
  }
}

function camps(): Reply {
  const s = W().shelters.slice().sort((a, b) => b.occupancy / b.capacity - a.occupancy / a.capacity)
  return {
    text: `${s.filter((x) => x.occupancy / x.capacity >= 0.8).length} camp(s) at or above 80%. Fullest first:`,
    tools: ["list_shelters(sort=occupancy)"],
    head: ["Camp", "Occupancy", "Full"],
    rows: s.slice(0, 6).map((x) => [x.name, `${x.occupancy}/${x.capacity}`, `${Math.round((x.occupancy / x.capacity) * 100)}%`]),
    links: [{ label: "Units & relief camps", to: "/admin/resources" }],
  }
}

export async function answer(raw: string): Promise<Reply> {
  const q = raw.toLowerCase().trim()
  const w = W()
  const has = (re: RegExp) => re.test(q)

  if (!q || has(/^(help|what can you|\?)/)) {
    return { text: "I read and act on the live plan. Ask for a situation report, the quantum plan and why it matters, what needs attention, where a unit is and why it was sent, camp occupancy; or tell me to fast-forward, re-plan, re-solve for a risk state, or block a road.", tools: [] }
  }

  // time control
  if (has(/(fast.?forward|jump|skip|go to)/)) {
    const target = has(/(12|delta)/) ? 720 : has(/(6|surge|budameru)/) ? 360 : null
    if (target === null) return { text: "Fast-forward to where? Try “fast-forward to the surge” (T+6 h) or “to delta flooding” (T+12 h).", tools: [] }
    if (w.minute >= target) return { text: `The event is already past ${clock(target)}.`, tools: [] }
    w.jumpTo(target)
    const s = situation()
    return { ...s, text: `Fast-forwarded to ${clock(target)}. ${s.text}`, tools: [`jump_to(${clock(target)})`, ...s.tools], acted: true }
  }
  if (has(/^(start|play|resume|run the event)/)) { w.play(); return { text: "Event clock running.", tools: ["play()"], acted: true } }
  if (has(/^(pause|stop)/)) { w.pause(); return { text: "Event clock paused. Reports still go through and the plan still answers them.", tools: ["pause()"], acted: true } }

  // quantum
  if (has(/(re-?solve|run (the )?(quantum|qaoa)|new plan for)/)) {
    const id: ScenarioId = has(/(12|delta)/) ? "t12" : has(/(6|surge|budameru)/) ? "t6" : "t0"
    await w.setScenario(id, "copilot request")
    const r = quantumPlan()
    return { ...r, text: `Re-solved for ${W().scenario?.label}. ${r.text}`, tools: [`set_risk_state(${id})`, "run_qaoa()", "stage_idle_units()", ...r.tools], acted: true }
  }
  if (has(/(why|benefit|impact|compare|worth|does it help|vs|versus|uniform|home station)/) && has(/(quantum|qaoa|pre-?position|staging|post|plan|uniform|home)/)) return impact()
  if (has(/(quantum|qaoa|staging|posts?\b|qubit)/)) return quantumPlan()

  // dispatch
  if (has(/(re-?plan|rebalance|re-?assign|re-?optimi[sz]e)/)) {
    const before = W().replanCount
    w.replan("copilot request")
    const changed = W().replanCount > before
    const ch = changed ? W().changes.filter((c) => c.change === "assigned" || c.change === "retasked") : []
    return {
      text: changed ? `Re-planned: ${ch.length} change(s).` : "Re-planned: every unit is already on its best job, nothing changed.",
      tools: ["run_dispatch_replan()"],
      head: ch.length ? ["Unit", "Change", "To", "Why"] : undefined,
      rows: ch.slice(0, 6).map((c) => [c.unitLabel, c.change, c.target, c.reason]),
      acted: true,
    }
  }

  // closures
  if (has(/(block|close|closed|flooded|cut off).*(road|at|near|in)/) || has(/road.*(block|closed)/)) {
    const p = places().find((x) => q.includes(x.name.toLowerCase()))
    if (!p) return { text: "Which place? Name a town or locality, e.g. “block the road at Kankipadu”.", tools: ["find_place()"] }
    const affected = w.units.filter((u) => u.task && km(u.task.target, p.pos) < 25).length
    w.blockRoad(p.pos, `Road reported blocked at ${p.name} (via copilot)`, "Copilot · operator")
    return { text: `Closure recorded at ${p.name}. Routes through it are recomputed and dispatch re-plans around it${affected ? `; ${affected} unit(s) working nearby were checked` : ""}.`, tools: [`find_place("${p.name}")`, "report_closure()", "reroute_affected()", "run_dispatch_replan()"], acted: true, links: [{ label: "Who is on what", to: "/admin/dispatch" }] }
  }

  // units
  const u = findUnit(q, w.units)
  if (u) {
    const why = u.task?.reason
    return {
      text: `${u.label} (${u.agency}, crew ${u.crew}): ${unitLine(u)}.${why ? ` Why: ${why}.` : u.status === "staging" ? " It was placed there by the QAOA plan so it starts closer to where risk is highest." : ""}`,
      tools: [`get_unit("${u.id}")`],
      links: [{ label: "Who is on what", to: "/admin/dispatch" }],
    }
  }

  if (has(/(sitrep|situation|summary|status|brief|what'?s happening|overview)/)) return situation()
  if (has(/(attention|waiting|unattended|nobody|gap|uncovered|stuck|needs)/)) return attention()
  if (has(/(approv)/)) return attention()
  if (has(/(camp|shelter|evacu)/)) return camps()
  if (has(/(incident|priority|critical|severe|worst|urgent)/)) return incidents()
  if (has(/(alert|warn|notify|sms)/)) {
    const p = places().find((x) => q.includes(x.name.toLowerCase()))
    return { text: `Draft for ${p?.name ?? "the affected area"}: “Flood warning: water is rising. Move to the nearest relief camp; call 1070 for rescue.” Alerts are sent by an officer from the Alerts screen, in English and Telugu.`, tools: ["draft_alert()"], links: [{ label: "Public alerts", to: "/admin/alerts" }] }
  }
  if (has(/(unit|fleet|boat|ambulance|team|crew)/)) {
    return {
      text: "Fleet status:",
      tools: ["list_units()"],
      head: ["Unit", "Now"],
      rows: w.units.map((x) => [x.label, unitLine(x)]),
    }
  }
  return { text: "I can't do that one yet. Try one of the suggestions below.", tools: [] }
}
