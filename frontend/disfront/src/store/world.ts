import { create } from "zustand"

import { dataMode } from "@/config/env"
import {
  CATEGORY, EVENT_END, RULES, SCRIPT, SHELTERS, UNITS, type Category, type ScriptItem, type Source,
} from "@/data/region"
import { along, distToPath, km, type LngLat } from "@/lib/geo"
import { getRoute, straight } from "@/lib/routing"
import {
  getBenchmark, getScenario, riskAt, solve as solveApi,
  type Benchmark, type Scenario, type ScenarioId, type SolveResult,
} from "@/lib/qadr"
import type {
  AlertMsg, Approval, CitizenReportInput, Closure, EventKind, Incident, PlanChange, Report, Shelter, TrustParts, Unit, WorldEvent,
} from "@/store/types"

interface Snapshot {
  scenarios: Record<ScenarioId, Scenario>
  solves: Record<ScenarioId, SolveResult>
  benchmarks: Record<ScenarioId, Benchmark>
}

interface World {
  ready: boolean
  loadError: string | null
  snapshot: Snapshot | null
  minute: number
  running: boolean
  speed: number
  scenarioId: ScenarioId
  scenario: Scenario | null
  placement: SolveResult | null
  /** placement before the current one, so the planner agent can say what changed */
  prevPlacement: SolveResult | null
  planVersion: number
  replanCount: number
  /** boat / rescue dispatches (what staging posts are for), and how many left from a QAOA post */
  dispatchStats: { total: number; fromPost: number; etaSum: number }
  units: Unit[]
  incidents: Incident[]
  reports: Report[]
  shelters: Shelter[]
  closures: Closure[]
  approvals: Approval[]
  alerts: AlertMsg[]
  events: WorldEvent[]
  changes: PlanChange[]
  lastReplanAt: number | null
  scriptIdx: number
  seq: number
  needsReplan: string | null

  init: () => Promise<void>
  reset: () => void
  play: () => void
  pause: () => void
  setSpeed: (s: number) => void
  tick: (realSeconds: number) => void
  jumpTo: (minute: number) => void
  fileReport: (input: CitizenReportInput) => { reportId: string; decision: Report["decision"]; incidentId?: string; trust: number }
  setScenario: (id: ScenarioId, cause?: string) => Promise<void>
  replan: (why: string) => void
  blockRoad: (pos: LngLat, reason: string, by: string) => void
  fieldUpdate: (unitId: string, action: "on_scene" | "resolved" | "offline" | "available" | "backup") => void
  decide: (approvalId: string, approve: boolean) => void
  sendAlert: (a: Omit<AlertMsg, "id" | "at">) => void
}

const SOURCE_CRED: Record<Source, number> = { field: 0.95, agency: 0.92, sensor: 0.88, citizen: 0.62 }
const SOURCE_HISTORY: Record<Source, number> = { field: 0.8, agency: 0.8, sensor: 0.75, citizen: 0.5 }
export const TRUST = { confirm: 0.72, official: 0.55, floor: 0.35 }
export const MAX_ETA = 180

/** Confirmed means a vehicle may be spent on it. */
export const confirmed = (trust: number, category: Category, source: Source) =>
  trust >= TRUST.confirm || (CATEGORY[category].lifeSafety && trust >= TRUST.floor) || (source !== "citizen" && trust >= TRUST.official)

const freshUnits = (): Unit[] => UNITS.map((u) => ({ ...u, pos: u.home, status: "available" as const }))
const freshShelters = (): Shelter[] => SHELTERS.map((s) => ({ ...s }))

function severityOf(category: Category, people: number) {
  switch (category) {
    case "stranded": return people >= 6 ? 5 : 4
    case "medical": return 4
    case "structure": return 4
    case "flooding": return people >= 30 ? 3 : 2
    case "supplies": return people >= 150 ? 3 : 2
  }
}

const bestSource = (reports: Report[], incidentId: string): Source =>
  reports.some((r) => r.incidentId === incidentId && r.source !== "citizen") ? "field" : "citizen"

const unitsNeeded = (i: Incident) => (i.category === "stranded" && i.people >= 10 ? 2 : 1)
const weightOf = (i: Incident) => i.severity ** 2 * (1 + i.people / 50)

function etaMin(u: Unit, to: LngLat, closures: Closure[]) {
  const line: LngLat[] = [u.pos, to]
  const blocked = closures.some((c) => distToPath(c.pos, line) < 0.6)
  return ((km(u.pos, to) * 1.3) / u.speedKmh) * 60 * (blocked ? 1.5 : 1)
}

export const useWorld = create<World>()((set, get) => {
  const nextId = (p: string) => {
    const n = get().seq + 1
    set({ seq: n })
    return `${p}-${n}`
  }
  const log = (kind: EventKind, text: string, cause?: string) => {
    const id = nextId("E")
    set((s) => ({ events: [{ id, at: s.minute, kind, text, cause }, ...s.events].slice(0, 500) }))
    return id
  }

  /** Ask the road network for a real route; replace the straight line when it answers. */
  const requestRoute = (unitId: string) => {
    const s = get()
    const u = s.units.find((x) => x.id === unitId)
    if (!u?.task) return
    const { target, assignedAt, targetId } = u.task
    const from = u.pos
    getRoute(from, target, "driving", s.closures.map((c) => c.pos), u.speedKmh).then((r) => {
      set((st) => ({
        units: st.units.map((x) => {
          if (x.id !== unitId || !x.task || x.task.assignedAt !== assignedAt || x.task.targetId !== targetId) return x
          const frac = x.task.lengthKm ? x.task.progressKm / x.task.lengthKm : 0
          const passes = r.engine !== "mapbox" && st.closures.some((c) => distToPath(c.pos, r.path) < 0.3)
          return {
            ...x,
            task: { ...x.task, path: r.path, lengthKm: r.distanceKm, progressKm: frac * r.distanceKm, engine: r.engine, steps: r.steps, etaMin: ((r.distanceKm * (1 - frac)) / x.speedKmh) * 60, passesClosure: passes },
          }
        }),
      }))
    })
  }

  const assign = (unit: Unit, kind: "incident" | "staging", targetId: string, target: LngLat, reason: string): Unit => {
    const r = straight(unit.pos, target, unit.speedKmh)
    return {
      ...unit,
      status: kind === "incident" ? "en_route" : "available",
      task: { kind, targetId, target, path: r.path, lengthKm: r.distanceKm, progressKm: 0, engine: "straight", etaMin: r.durationMin, steps: r.steps, assignedAt: get().minute + Math.random() * 1e-6, reason },
    }
  }

  const trustOf = (input: CitizenReportInput, reports: Report[], minute: number, sc: Scenario | null): { trust: number; parts: TrustParts; corroborators: number } => {
    const near = reports.filter((r) => r.category === input.category && minute - r.at <= 120 && km(r.pos, input.pos) <= 1.5)
    const voices = new Set(near.map((r) => r.reporter ?? `${r.source}-${r.id}`))
    if (input.reporter) voices.delete(input.reporter)
    const n = voices.size
    const recent = input.reporter ? reports.filter((r) => r.reporter === input.reporter && minute - r.at <= 15) : []
    const burst = recent.length
    const copies = recent.filter((r) => r.text.trim().toLowerCase() === input.text.trim().toLowerCase()).length
    const parts: TrustParts = {
      source: SOURCE_CRED[input.source],
      history: SOURCE_HISTORY[input.source],
      location: Math.min(1, 0.35 + 0.65 * (sc ? Math.min(1, riskAt(sc, input.pos)) : 0.5)),
      corroboration: 1 - 1 / (1 + 0.9 * n),
      evidence: input.photo ? 0.8 : 0.65,
      anomaly: Math.min(0.85, (burst > 3 ? Math.min(0.5, 0.12 * (burst - 3)) : 0) + Math.min(0.35, 0.15 * copies)),
    }
    const raw = (0.22 * parts.source + 0.18 * parts.history + 0.18 * parts.location + 0.22 * parts.corroboration + 0.1 * parts.evidence) / 0.9
    return { trust: raw * (1 - 0.7 * parts.anomaly), parts, corroborators: n }
  }

  /** Quantum placement for the current risk state: idle units move to the QAOA-selected staging posts. */
  const stageFromPlacement = (res: SolveResult, cause: string) => {
    const s = get()
    const sc = s.scenario
    if (!sc) return
    const idle = s.units.filter((u) => (u.status === "available" || u.status === "staging") && !u.task && !u.outsideDistrict)
    const used = new Set<string>()
    const moves: Record<string, { site: string; pos: LngLat }> = {}
    // Life-safety capability first: boats, then rescue teams, then the rest.
    const rank = (u: Unit) => (u.capabilities.includes("boat") ? 0 : u.capabilities.includes("rescue") ? 1 : 2)
    for (const siteId of res.selection) {
      const site = sc.candidates[siteId]
      const pos: LngLat = [site.lng, site.lat]
      const best = idle.filter((u) => !used.has(u.id)).sort((a, b) => rank(a) - rank(b) || km(a.pos, pos) - km(b.pos, pos))[0]
      if (!best) break
      used.add(best.id)
      if (km(best.pos, pos) > 0.3) moves[best.id] = { site: site.name, pos }
    }
    const changes: PlanChange[] = []
    set((st) => ({
      units: st.units.map((u) => {
        const m = moves[u.id]
        if (!m) return u
        changes.push({ unitId: u.id, unitLabel: u.label, change: "staged", target: m.site, reason: `QAOA staging post for ${sc.label}` })
        return assign(u, "staging", `site:${m.site}`, m.pos, `QAOA staging post (${sc.label})`)
      }),
    }))
    Object.keys(moves).forEach(requestRoute)
    if (changes.length) {
      log("quantum", `QAOA placement: ${changes.length} idle units moving to staging posts ${changes.map((c) => c.target).join(", ")}`, cause)
      set((st) => ({ changes: [...changes, ...st.changes.filter((c) => c.change !== "staged")] }))
    }
  }

  return {
    ready: false,
    loadError: null,
    snapshot: null,
    minute: 0,
    running: false,
    speed: 6,
    scenarioId: "t0",
    scenario: null,
    placement: null,
    prevPlacement: null,
    planVersion: 0,
    replanCount: 0,
    dispatchStats: { total: 0, fromPost: 0, etaSum: 0 },
    units: freshUnits(),
    incidents: [],
    reports: [],
    shelters: freshShelters(),
    closures: [],
    approvals: [],
    alerts: [],
    events: [],
    changes: [],
    lastReplanAt: null,
    scriptIdx: 0,
    seq: 0,
    needsReplan: null,

    init: async () => {
      if (get().ready) return
      try {
        if (dataMode === "demo") {
          const snap = (await (await fetch(`${import.meta.env.BASE_URL}snapshot.json`)).json()) as Snapshot
          set({ snapshot: snap })
        }
        set({ ready: true })
        get().reset()
      } catch (e) {
        set({ loadError: e instanceof Error ? e.message : String(e) })
      }
    },

    reset: () => {
      set({
        minute: 0, running: false, units: freshUnits(), incidents: [], reports: [], shelters: freshShelters(), closures: [],
        approvals: [], alerts: [], events: [], changes: [], lastReplanAt: null, scriptIdx: 0, needsReplan: null, placement: null,
        prevPlacement: null, planVersion: 0, replanCount: 0, dispatchStats: { total: 0, fromPost: 0, etaSum: 0 },
      })
      log("system", "World reset: units at their home stations, no reports yet")
      void get().setScenario("t0", "reset")
    },

    play: () => set({ running: true }),
    pause: () => set({ running: false }),
    setSpeed: (speed) => set({ speed }),

    tick: (realSeconds) => {
      const s = get()
      if (!s.ready) return
      if (!s.running) {
        // paused: people can still report, and the plan still answers them
        const pend = s.needsReplan
        if (pend) { set({ needsReplan: null }); get().replan(pend) }
        return
      }
      const dt = realSeconds * s.speed
      let minute = s.minute + dt
      if (minute >= EVENT_END) { minute = EVENT_END; set({ running: false }) }
      set({ minute })

      // 1. script items that are due go through the same doors as people do
      let idx = get().scriptIdx
      while (idx < SCRIPT.length && SCRIPT[idx].at <= minute) {
        const it: ScriptItem = SCRIPT[idx]
        idx++
        set({ scriptIdx: idx })
        if (it.kind === "scenario") void get().setScenario(it.id, "event clock")
        else if (it.kind === "closure") get().blockRoad(it.pos, it.reason, it.by)
        else get().fileReport({ source: it.source, category: it.category, people: it.people, pos: it.pos, place: it.place, text: it.text, photo: it.photo, reporter: it.reporter })
      }

      // 2. movement and on-scene work
      const arrivals: string[] = []
      const finished: string[] = []
      set((st) => ({
        units: st.units.map((u) => {
          if (u.task) {
            const progressKm = Math.min(u.task.lengthKm, u.task.progressKm + (u.speedKmh * dt) / 60)
            const pos = along(u.task.path, progressKm)
            if (progressKm >= u.task.lengthKm - 1e-6) {
              if (u.task.kind === "incident") {
                arrivals.push(u.id)
                const inc = st.incidents.find((i) => i.id === u.task!.targetId)
                return { ...u, pos: u.task.target, status: "on_scene" as const, task: undefined, busyUntil: minute + (inc ? CATEGORY[inc.category].serviceMin : 30) }
              }
              return { ...u, pos: u.task.target, status: "staging" as const, task: undefined, stagedAt: u.task.targetId.replace("site:", "") }
            }
            return { ...u, pos, task: { ...u.task, progressKm, etaMin: ((u.task.lengthKm - progressKm) / u.speedKmh) * 60 } }
          }
          if (u.status === "on_scene" && u.busyUntil !== undefined && minute >= u.busyUntil) {
            finished.push(u.id)
            return { ...u, status: "available" as const, busyUntil: undefined }
          }
          return u
        }),
      }))
      const st = get()
      for (const id of arrivals) {
        const u = st.units.find((x) => x.id === id)!
        const inc = st.incidents.find((i) => i.unitIds.includes(id) && i.status !== "resolved")
        if (inc) {
          set((w) => ({ incidents: w.incidents.map((i) => (i.id === inc.id ? { ...i, status: "on_scene" } : i)) }))
          log("field", `${u.label} on scene: ${inc.title}`)
        }
      }
      for (const id of finished) {
        const u = get().units.find((x) => x.id === id)!
        const inc = get().incidents.find((i) => i.unitIds.includes(id) && i.status !== "resolved")
        if (!inc) continue
        const stillBusy = get().units.some((x) => inc.unitIds.includes(x.id) && x.id !== id && (x.status === "on_scene" || x.status === "en_route"))
        if (!stillBusy) {
          set((w) => ({ incidents: w.incidents.map((i) => (i.id === inc.id ? { ...i, status: "resolved", resolvedAt: minute } : i)) }))
          log("field", `${u.label} cleared ${inc.title}`)
          if (inc.category === "stranded") {
            const shelters = get().shelters.slice().sort((a, b) => km(a.pos, inc.pos) - km(b.pos, inc.pos))
            const sh = shelters[0]
            const occ = sh.occupancy + inc.people
            set((w) => ({ shelters: w.shelters.map((x) => (x.id === sh.id ? { ...x, occupancy: occ } : x)) }))
            log("field", `${inc.people} people evacuated to ${sh.name} (${occ}/${sh.capacity})`)
            if (occ > sh.capacity * 0.95 && !sh.overflowApproved && !get().approvals.some((a) => a.refId === sh.id && a.status === "pending")) {
              const aid = nextId("A")
              set((w) => ({ approvals: [{ id: aid, at: minute, title: `Admit above capacity at ${sh.name}`, detail: `${occ} people against a rated capacity of ${sh.capacity}.`, rule: RULES.overCapacity, status: "pending", kind: "over_capacity", refId: sh.id }, ...w.approvals] }))
              log("approval", `Waiting for the Relief Officer: ${sh.name} is at ${Math.round((occ / sh.capacity) * 100)}%`)
            }
          }
          get().replan(`${inc.title} resolved`)
        }
      }
      const r = get().needsReplan
      if (r) { set({ needsReplan: null }); get().replan(r) }
    },

    jumpTo: (target) => {
      const was = get().running
      set({ running: true })
      while (get().minute < Math.min(target, EVENT_END)) {
        const step = Math.min(1, target - get().minute)
        const sp = get().speed
        get().tick(step / sp)
      }
      set({ running: was })
    },

    fileReport: (input) => {
      const s = get()
      const { trust, parts, corroborators } = trustOf(input, s.reports, s.minute, s.scenario)
      const id = nextId("R")
      const isConfirmed = confirmed(trust, input.category, input.source)
      let decision: Report["decision"] = "held"
      let incidentId: string | undefined
      if (trust >= TRUST.floor) {
        const match = s.incidents.find((i) => i.status !== "resolved" && i.category === input.category && km(i.pos, input.pos) <= 1.2)
        if (match) {
          decision = "merged"; incidentId = match.id
          set((w) => ({
            incidents: w.incidents.map((i) => i.id === match.id ? {
              ...i, reportIds: [...i.reportIds, id], people: Math.max(i.people, input.people), trust: Math.max(i.trust, trust),
              severity: Math.min(5, Math.max(i.severity, severityOf(input.category, input.people)) + (i.reportIds.length + 1 >= 3 ? 1 : 0)),
            } : i),
          }))
          log("incident", `Report merged into ${match.title} (${match.reportIds.length + 1} reports)`, id)
        } else {
          decision = "opened"; incidentId = nextId("I")
          const inc: Incident = {
            id: incidentId, title: `${CATEGORY[input.category].label} · ${input.place}`, category: input.category,
            severity: severityOf(input.category, input.people), people: input.people, pos: input.pos, place: input.place,
            reportIds: [id], status: "open", trust, createdAt: s.minute, unitIds: [],
          }
          set((w) => ({ incidents: [inc, ...w.incidents] }))
          log("incident", `New incident: ${inc.title} (severity ${inc.severity}, trust ${trust.toFixed(2)}${isConfirmed ? "" : ", needs corroboration"})`, id)
        }
      } else {
        log("report", `Report held below the trust floor (${trust.toFixed(2)}): "${input.text}"`, id)
      }
      const rep: Report = { id, at: s.minute, ...input, photo: !!input.photo, trust, parts, decision, incidentId, corroborators }
      set((w) => ({ reports: [rep, ...w.reports] }))
      if (decision !== "held") {
        const inc = get().incidents.find((i) => i.id === incidentId)!
        if (confirmed(inc.trust, inc.category, bestSource(get().reports, inc.id))) set({ needsReplan: `${inc.title}` })
      }
      return { reportId: id, decision, incidentId, trust }
    },

    setScenario: async (id, cause = "operator") => {
      const s = get()
      let sc: Scenario
      let placement: SolveResult | null
      try {
        if (dataMode === "demo" && s.snapshot) {
          sc = s.snapshot.scenarios[id]
          placement = s.snapshot.solves[id]
        } else {
          sc = await getScenario(id, true)
          const prev = get().placement
          placement = await solveApi({ scenario: id, k: 6, method: "qaoa_sim", p: 2, shots: 4096, local: true, previous: prev?.regions ? { scenario: prev.scenario, regions: prev.regions } : undefined }, true)
        }
      } catch (e) {
        log("system", `Could not load ${id}: ${e instanceof Error ? e.message : String(e)}`)
        return
      }
      set((w) => ({ scenarioId: id, scenario: sc, prevPlacement: w.placement, placement, planVersion: w.planVersion + (id !== w.scenarioId || !w.placement ? 1 : 0) }))
      log("scenario", `Risk state → ${sc.label}`, cause)
      if (placement?.regions) {
        const rs = Object.values(placement.regions)
        log("quantum", `Plan v${get().planVersion}: QAOA re-solved staging: ${rs.map((r) => `${r.region} ${r.qubits} qubits, ${r.warmStarted ? "warm start" : "cold start"}, ${r.costEvals} evaluations`).join("; ")}. Coverage ${(placement.coverage * 100).toFixed(1)}% (ratio ${placement.ratio.toFixed(3)} vs exact)`)
      }
      if (placement) stageFromPlacement(placement, cause)
      set({ needsReplan: `risk state changed to ${sc.label}` })
    },

    replan: (why) => {
      const s = get()
      const demands = s.incidents
        .filter((i) => i.status !== "resolved" && confirmed(i.trust, i.category, bestSource(s.reports, i.id)))
        .filter((i) => i.unitIds.filter((uid) => s.units.find((u) => u.id === uid && (u.status === "en_route" || u.status === "on_scene"))).length < unitsNeeded(i))
        .sort((a, b) => weightOf(b) - weightOf(a))
      if (!demands.length) { set({ lastReplanAt: s.minute }); return }
      let units = s.units.slice()
      let incidents = s.incidents.slice()
      const changes: PlanChange[] = []
      const routed: string[] = []
      for (const d of demands) {
        const need = CATEGORY[d.category].needs
        const have = d.unitIds.filter((uid) => units.find((u) => u.id === uid && (u.status === "en_route" || u.status === "on_scene"))).length
        for (let k = have; k < unitsNeeded(d); k++) {
          const candidates = units
            .filter((u) => u.capabilities.includes(need) && u.status !== "offline" && u.status !== "on_scene" && !d.unitIds.includes(u.id))
            .map((u) => {
              const eta = etaMin(u, d.pos, s.closures)
              if (u.status === "en_route" && u.task?.kind === "incident") {
                const cur = incidents.find((i) => i.id === u.task!.targetId)
                const progress = u.task.lengthKm ? u.task.progressKm / u.task.lengthKm : 0
                const mult = 1 + 0.6 * (0.25 + 0.75 * progress)
                if (!cur || weightOf(cur) * 2 * mult >= weightOf(d)) return null
                return { u, eta: eta * mult, retask: cur }
              }
              return { u, eta, retask: undefined as Incident | undefined }
            })
            .filter((x): x is { u: Unit; eta: number; retask: Incident | undefined } => !!x && x.eta <= MAX_ETA)
            .sort((a, b) => a.eta - b.eta)
          const pick = candidates[0]
          if (!pick) {
            if (CATEGORY[d.category].lifeSafety && !get().approvals.some((a) => a.refId === d.id)) {
              const aid = nextId("A")
              set((w) => ({ approvals: [{ id: aid, at: s.minute, title: `Requisition an outside ${need === "boat" ? "boat team" : "team"} for ${d.title}`, detail: `No in-district ${need} unit can reach it within ${MAX_ETA} minutes. Nearest outside team: NDRF, Guntur.`, rule: RULES.outsideTeam, status: "pending", kind: "outside_team", refId: d.id }, ...w.approvals] }))
              log("approval", `Waiting for the District Collector: outside team for ${d.title}`)
            }
            break
          }
          const atPost = !pick.retask && pick.u.status === "staging" ? pick.u.stagedAt : undefined
          const toPost = !pick.retask && pick.u.task?.kind === "staging" ? pick.u.task.targetId.replace("site:", "") : undefined
          const post = atPost ?? toPost
          const reason = `${pick.retask ? "re-tasked from a lower-priority job; " : ""}${atPost ? `launched from QAOA post ${atPost}; ` : toPost ? `diverted on its way to QAOA post ${toPost}; ` : ""}nearest ${need} unit, ETA ${Math.round(pick.eta)} min, severity ${d.severity}${d.people ? `, ${d.people} people` : ""}`
          units = units.map((u) => {
            if (u.id !== pick.u.id) return u
            const a = assign(u, "incident", d.id, d.pos, reason)
            return { ...a, stagedAt: undefined, task: a.task ? { ...a.task, fromPost: post } : a.task }
          })
          if (!pick.retask && (need === "boat" || need === "rescue")) set((w) => ({ dispatchStats: { total: w.dispatchStats.total + 1, fromPost: w.dispatchStats.fromPost + (post ? 1 : 0), etaSum: w.dispatchStats.etaSum + pick.eta } }))
          incidents = incidents.map((i) => {
            if (i.id === d.id) return { ...i, status: i.status === "open" ? "assigned" : i.status, unitIds: [...i.unitIds, pick.u.id] }
            if (pick.retask && i.id === pick.retask.id) return { ...i, unitIds: i.unitIds.filter((x) => x !== pick.u.id), status: i.unitIds.length <= 1 ? "open" : i.status }
            return i
          })
          changes.push({ unitId: pick.u.id, unitLabel: pick.u.label, change: pick.retask ? "retasked" : "assigned", target: d.title, reason })
          routed.push(pick.u.id)
        }
      }
      const kept = units.filter((u) => u.status === "en_route" && !routed.includes(u.id)).map((u) => ({ unitId: u.id, unitLabel: u.label, change: "kept" as const, target: incidents.find((i) => i.id === u.task?.targetId)?.title ?? "", reason: "still the best unit for this job" }))
      set((w) => ({ units, incidents, changes: [...changes, ...kept], lastReplanAt: s.minute, replanCount: w.replanCount + (changes.length ? 1 : 0) }))
      routed.forEach(requestRoute)
      if (changes.length) log("replan", `Re-planned (${why}): ${changes.map((c) => `${c.unitLabel} → ${c.target}`).join("; ")}`)
    },

    blockRoad: (pos, reason, by) => {
      const id = nextId("C")
      set((s) => ({ closures: [{ id, pos, reason, by, at: s.minute }, ...s.closures] }))
      log("closure", `Road closed: ${reason} (reported by ${by})`, id)
      // re-route anyone whose path runs through it
      const affected = get().units.filter((u) => u.task && distToPath(pos, u.task.path.slice(0)) < 0.5)
      affected.forEach((u) => requestRoute(u.id))
      if (affected.length) log("replan", `${affected.length} route(s) recomputed around the closure`, id)
      set({ needsReplan: "road closure" })
    },

    fieldUpdate: (unitId, action) => {
      const s = get()
      const u = s.units.find((x) => x.id === unitId)
      if (!u) return
      if (action === "on_scene" && u.task?.kind === "incident") {
        set((w) => ({ units: w.units.map((x) => (x.id === unitId ? { ...x, task: { ...x.task!, progressKm: x.task!.lengthKm } } : x)) }))
        get().tick(0.001)
      } else if (action === "resolved") {
        set((w) => ({ units: w.units.map((x) => (x.id === unitId ? { ...x, busyUntil: w.minute } : x)) }))
      } else if (action === "offline") {
        const inc = s.incidents.find((i) => i.unitIds.includes(unitId) && i.status !== "resolved")
        set((w) => ({
          units: w.units.map((x) => (x.id === unitId ? { ...x, status: "offline", task: undefined } : x)),
          incidents: w.incidents.map((i) => (inc && i.id === inc.id ? { ...i, unitIds: i.unitIds.filter((x) => x !== unitId), status: "open" } : i)),
        }))
        log("field", `${u.label} out of service${inc ? `, ${inc.title} needs another unit` : ""}`)
        set({ needsReplan: `${u.label} out of service` })
      } else if (action === "available") {
        set((w) => ({ units: w.units.map((x) => (x.id === unitId ? { ...x, status: "available" } : x)) }))
        log("field", `${u.label} back in service`)
        set({ needsReplan: `${u.label} back in service` })
      } else if (action === "backup") {
        const inc = s.incidents.find((i) => i.unitIds.includes(unitId) && i.status !== "resolved")
        if (inc) {
          set((w) => ({ incidents: w.incidents.map((i) => (i.id === inc.id ? { ...i, people: i.people + 5, severity: Math.min(5, i.severity + 1) } : i)) }))
          log("field", `${u.label} requests backup at ${inc.title}`)
          set({ needsReplan: `backup requested at ${inc.title}` })
        }
      }
    },

    decide: (approvalId, approve) => {
      const s = get()
      const a = s.approvals.find((x) => x.id === approvalId)
      if (!a || a.status !== "pending") return
      set((w) => ({ approvals: w.approvals.map((x) => (x.id === approvalId ? { ...x, status: approve ? "approved" : "declined", decidedAt: w.minute } : x)) }))
      log("approval", `${approve ? "Approved" : "Declined"}: ${a.title} (${a.rule.id})`)
      if (!approve) return
      if (a.kind === "outside_team") {
        const id = nextId("NDRF-GNT")
        const unit: Unit = { id, label: "NDRF Boat (Guntur)", agency: "NDRF, Guntur", capabilities: ["boat", "rescue"], speedKmh: 18, home: [80.44, 16.3], pos: [80.44, 16.3], crew: "Outside team", status: "available", outsideDistrict: true }
        set((w) => ({ units: [...w.units, unit] }))
        log("dispatch", `${unit.label} joins the fleet under ${a.rule.id}`)
        get().replan("outside team approved")
      } else {
        set((w) => ({ shelters: w.shelters.map((x) => (x.id === a.refId ? { ...x, overflowApproved: true } : x)) }))
      }
    },

    sendAlert: (a) => {
      const id = nextId("AL")
      set((s) => ({ alerts: [{ ...a, id, at: s.minute }, ...s.alerts] }))
      log("alert", `Alert issued to ${a.area} via ${a.channels.join(", ")}: ${a.title}`)
    },
  }
})

/** Selectors used across screens. */
export const selectOpen = (s: World) => s.incidents.filter((i) => i.status !== "resolved")
/** Open and confirmed (so a vehicle should be spent) but nobody is on the way. */
export const selectUnattended = (s: World) => s.incidents.filter((i) => i.status === "open" && confirmed(i.trust, i.category, bestSource(s.reports, i.id)))
/** Every open incident without a unit, including those still waiting for corroboration. */
export const selectOpenUnassigned = (s: World) => s.incidents.filter((i) => i.status === "open")
export const selectPending = (s: World) => s.approvals.filter((a) => a.status === "pending")
export const selectHeld = (s: World) => s.reports.filter((r) => r.decision === "held")

export function clock(minute: number) {
  const h = Math.floor(minute / 60)
  const m = Math.floor(minute % 60)
  return `T+${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Loads the benchmark for the After-action screen (recorded in demo mode). */
export async function loadBenchmark(id: ScenarioId): Promise<Benchmark> {
  const snap = useWorld.getState().snapshot
  if (dataMode === "demo" && snap) return snap.benchmarks[id]
  return getBenchmark(id, 6, true)
}
