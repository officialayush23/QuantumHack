import { env } from "@/config/env"
import { km, type LngLat } from "@/lib/geo"

export type RouteEngine = "mapbox" | "osrm" | "straight"

export interface RouteStep {
  instruction: string
  distanceKm: number
}

export interface Route {
  path: LngLat[]
  distanceKm: number
  durationMin: number
  engine: RouteEngine
  steps: RouteStep[]
}

export type Profile = "driving" | "walking"

const cache = new Map<string, Promise<Route>>()

/** Road route from a to b.
 *
 *  Degrades Mapbox Directions → public OSRM → straight line, and always says which one answered,
 *  because an ETA from a straight line is a guess and must not be shown as a road time.
 *  Mapbox honours reported closures through `exclude=point(...)`; OSRM cannot, so those routes
 *  are flagged by the caller when they pass a closure.
 */
export function getRoute(a: LngLat, b: LngLat, profile: Profile = "driving", avoid: LngLat[] = [], speedKmh = 30): Promise<Route> {
  const key = [a, b, profile, avoid].map((x) => JSON.stringify(x)).join("|")
  const hit = cache.get(key)
  if (hit) return hit
  const p = (async () => {
    if (env.mapboxToken) {
      try {
        return await mapbox(a, b, profile, avoid)
      } catch {
        /* fall through */
      }
    }
    try {
      return await osrm(a, b, profile)
    } catch {
      return straight(a, b, speedKmh)
    }
  })()
  cache.set(key, p)
  return p
}

export function straight(a: LngLat, b: LngLat, speedKmh = 30): Route {
  const d = km(a, b) * 1.3 // road detour factor
  return { path: [a, b], distanceKm: d, durationMin: (d / speedKmh) * 60, engine: "straight", steps: [{ instruction: "Head towards the destination (no road data)", distanceKm: d }] }
}

async function mapbox(a: LngLat, b: LngLat, profile: Profile, avoid: LngLat[]): Promise<Route> {
  const prof = profile === "walking" ? "walking" : "driving"
  const params = new URLSearchParams({ geometries: "geojson", steps: "true", overview: "full", access_token: env.mapboxToken! })
  if (avoid.length && prof === "driving") params.set("exclude", avoid.slice(0, 50).map((p) => `point(${p[0].toFixed(5)} ${p[1].toFixed(5)})`).join(","))
  const url = `https://api.mapbox.com/directions/v5/mapbox/${prof}/${a.join(",")};${b.join(",")}?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`mapbox ${res.status}`)
  const j = await res.json()
  const r = j.routes?.[0]
  if (!r) throw new Error("no route")
  return {
    path: r.geometry.coordinates as LngLat[],
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    engine: "mapbox",
    steps: (r.legs?.[0]?.steps ?? []).map((s: { maneuver: { instruction: string }; distance: number }) => ({ instruction: s.maneuver.instruction, distanceKm: s.distance / 1000 })),
  }
}

async function osrm(a: LngLat, b: LngLat, profile: Profile): Promise<Route> {
  const prof = profile === "walking" ? "foot" : "driving"
  const url = `https://router.project-osrm.org/route/v1/${prof}/${a.join(",")};${b.join(",")}?overview=full&geometries=geojson&steps=true`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`osrm ${res.status}`)
    const j = await res.json()
    const r = j.routes?.[0]
    if (!r) throw new Error("no route")
    return {
      path: r.geometry.coordinates as LngLat[],
      distanceKm: r.distance / 1000,
      durationMin: r.duration / 60,
      engine: "osrm",
      steps: (r.legs?.[0]?.steps ?? []).map((s: { maneuver: { type: string; modifier?: string }; name: string; distance: number }) => ({
        instruction: `${s.maneuver.type}${s.maneuver.modifier ? " " + s.maneuver.modifier : ""}${s.name ? " onto " + s.name : ""}`,
        distanceKm: s.distance / 1000,
      })),
    }
  } finally {
    clearTimeout(t)
  }
}

export const ENGINE_LABEL: Record<RouteEngine, string> = {
  mapbox: "Mapbox road route",
  osrm: "OSRM road route (closures not avoided)",
  straight: "Straight line, no road data",
}
