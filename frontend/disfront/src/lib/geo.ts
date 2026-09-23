export type LngLat = [number, number]

/** Equirectangular distance in km; within 0.5% of haversine at district scale. */
export function km(a: LngLat, b: LngLat) {
  const mlat = (((a[1] + b[1]) / 2) * Math.PI) / 180
  return Math.hypot((b[0] - a[0]) * 111.32 * Math.cos(mlat), (b[1] - a[1]) * 110.57)
}

export function pathKm(path: LngLat[]) {
  let d = 0
  for (let i = 1; i < path.length; i++) d += km(path[i - 1], path[i])
  return d
}

/** The point `dist` km along `path`. */
export function along(path: LngLat[], dist: number): LngLat {
  if (path.length === 0) return [0, 0]
  let left = Math.max(0, dist)
  for (let i = 1; i < path.length; i++) {
    const seg = km(path[i - 1], path[i])
    if (left <= seg && seg > 0) {
      const t = left / seg
      return [path[i - 1][0] + t * (path[i][0] - path[i - 1][0]), path[i - 1][1] + t * (path[i][1] - path[i - 1][1])]
    }
    left -= seg
  }
  return path[path.length - 1]
}

/** Remaining part of a path from `dist` km onwards, for drawing what is still ahead of a unit. */
export function remaining(path: LngLat[], dist: number): LngLat[] {
  const out: LngLat[] = [along(path, dist)]
  let acc = 0
  for (let i = 1; i < path.length; i++) {
    acc += km(path[i - 1], path[i])
    if (acc > dist) out.push(path[i])
  }
  return out
}

/** Polygon approximating a circle of `radiusKm`, for coverage areas. */
export function circle(center: LngLat, radiusKm: number, steps = 48): LngLat[] {
  const out: LngLat[] = []
  const dLat = radiusKm / 110.57
  const dLng = radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180))
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    out.push([center[0] + dLng * Math.cos(a), center[1] + dLat * Math.sin(a)])
  }
  return out
}

/** Shortest distance in km from point p to the polyline. */
export function distToPath(p: LngLat, path: LngLat[]) {
  if (path.length < 2) return path.length ? km(p, path[0]) : Infinity
  const k = Math.cos((p[1] * Math.PI) / 180) * 111.32
  const xy = (q: LngLat) => [q[0] * k, q[1] * 110.57]
  const [px, py] = xy(p)
  let best = Infinity
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = xy(path[i - 1])
    const [bx, by] = xy(path[i])
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy))
  }
  return best
}

export const fmtKm = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`)
export const fmtMin = (m: number) => (m < 1 ? "<1 min" : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`)
