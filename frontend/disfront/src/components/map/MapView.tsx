import * as React from "react"
import mapboxgl from "mapbox-gl"
import type { Feature, FeatureCollection } from "geojson"
import "mapbox-gl/dist/mapbox-gl.css"

import { env } from "@/config/env"
import { circle, type LngLat } from "@/lib/geo"
import { cn } from "@/lib/utils"

/** One Mapbox map for every screen.
 *
 *  Screens differ in which layers get data, not in how the map works, so the citizen app, the
 *  field app and the command console cannot disagree about where something is. Sources are
 *  created once and updated with setData: rebuilding layers on every tick makes markers flicker,
 *  which on a projector reads as a struggling system.
 */

export type RiskCellF = { lng: number; lat: number; level: string | null; risk: number; dlon: number; dlat: number }
export type IncidentF = { id: string; title: string; severity: number; status: string; people: number; pos: LngLat; trust: number; reports: number }
export type UnitF = { id: string; label: string; status: string; pos: LngLat; agency: string; task?: string; eta?: number }
export type ShelterF = { id: string; name: string; pos: LngLat; capacity: number; occupancy: number }
export type PointF = { id: string; name: string; pos: LngLat; note?: string }
export type RouteF = { id: string; path: LngLat[]; kind: "incident" | "staging"; label: string; engine: string; warn?: boolean }
export type SiteF = { id: number; name: string; pos: LngLat; selected: boolean }

export interface MapViewProps {
  risk?: RiskCellF[]
  coverage?: { pos: LngLat; km: number }[]
  sites?: SiteF[]
  samples?: LngLat[]
  incidents?: IncidentF[]
  units?: UnitF[]
  shelters?: ShelterF[]
  hospitals?: PointF[]
  closures?: PointF[]
  routes?: RouteF[]
  highlight?: LngLat[]
  me?: LngLat | null
  center?: LngLat
  zoom?: number
  /** change the key to fly to these bounds */
  fit?: { key: string | number; points: LngLat[] }
  onPick?: (layer: "incident" | "unit" | "shelter" | "site" | "map", id: string, pos: LngLat) => void
  className?: string
  interactive?: boolean
}

const POPUP_CSS = `
.qadr-pop .mapboxgl-popup-content{background:rgb(20 22 24/.96);color:#eceae4;border:1px solid rgb(255 255 255/.14);border-radius:10px;padding:10px 12px;box-shadow:0 10px 30px rgb(0 0 0/.45);max-width:300px;font:12px/1.45 ui-sans-serif,system-ui,sans-serif}
.qadr-pop .mapboxgl-popup-tip{border-top-color:rgb(20 22 24/.96)!important;border-bottom-color:rgb(20 22 24/.96)!important}
.qadr-pop b{color:#fff}.qadr-pop .muted{color:#a9a59c}.qadr-pop .row{margin-top:4px}
`

const RISK_COLOR = ["match", ["get", "level"], "low", "#F1DDC6", "moderate", "#EDB185", "high", "#E56A1F", "severe", "#C83A2A", "rgba(0,0,0,0)"]
const SEV_COLOR = ["interpolate", ["linear"], ["get", "severity"], 1, "#f1c27d", 3, "#e56a1f", 5, "#c83a2a"]
const UNIT_COLOR = ["match", ["get", "status"], "available", "#8DB596", "staging", "#4FB3A9", "en_route", "#E5A11F", "on_scene", "#E56A1F", "offline", "#6b6b6b", "#bbbbbb"]

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!))
const fc = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features })
const pt = (pos: LngLat, props: Record<string, unknown>): Feature => ({ type: "Feature", geometry: { type: "Point", coordinates: pos }, properties: props })

export function MapView(props: MapViewProps) {
  const { center = [80.66, 16.4], zoom = 8.6, className, interactive = true } = props
  const box = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = React.useState(false)
  const pickRef = React.useRef(props.onPick)
  React.useEffect(() => { pickRef.current = props.onPick }, [props.onPick])

  React.useEffect(() => {
    if (!env.mapboxToken || !box.current) return
    if (!document.getElementById("qadr-pop-css")) {
      const st = document.createElement("style"); st.id = "qadr-pop-css"; st.textContent = POPUP_CSS; document.head.appendChild(st)
    }
    mapboxgl.accessToken = env.mapboxToken
    const map = new mapboxgl.Map({ container: box.current, style: "mapbox://styles/mapbox/dark-v11", center, zoom, interactive, attributionControl: true })
    mapRef.current = map
    if (interactive) map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right")
    map.on("load", () => {
      const empty = fc([])
      for (const id of ["risk", "coverage", "sites", "samples", "routes", "highlight", "shelters", "hospitals", "closures", "incidents", "units", "me"]) map.addSource(id, { type: "geojson", data: empty })
      map.addLayer({ id: "risk", type: "fill", source: "risk", paint: { "fill-color": RISK_COLOR as never, "fill-opacity": 0.55, "fill-outline-color": "rgba(0,0,0,0.15)" } })
      map.addLayer({ id: "coverage-fill", type: "fill", source: "coverage", paint: { "fill-color": "#E56A1F", "fill-opacity": 0.08 } })
      map.addLayer({ id: "coverage-line", type: "line", source: "coverage", paint: { "line-color": "#E56A1F", "line-width": 1.4, "line-opacity": 0.8 } })
      map.addLayer({ id: "routes", type: "line", source: "routes", filter: ["!", ["get", "warn"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["match", ["get", "kind"], "staging", "#4FB3A9", "#E5A11F"] as never, "line-width": 3, "line-opacity": 0.9 } })
      map.addLayer({ id: "routes-warn", type: "line", source: "routes", filter: ["get", "warn"], paint: { "line-color": "#C83A2A", "line-width": 3, "line-dasharray": [1.5, 1.5] } })
      map.addLayer({ id: "highlight", type: "line", source: "highlight", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#6FE3A1", "line-width": 5 } })
      map.addLayer({ id: "sites", type: "circle", source: "sites", paint: { "circle-radius": ["case", ["get", "selected"], 7, 4] as never, "circle-color": ["case", ["get", "selected"], "#E56A1F", "#1c1b19"] as never, "circle-stroke-color": "#F5F2EA", "circle-stroke-width": 1.5 } })
      map.addLayer({ id: "samples", type: "circle", source: "samples", paint: { "circle-radius": 13, "circle-color": "#E56A1F", "circle-opacity": 0.25, "circle-stroke-color": "#E56A1F", "circle-stroke-width": 3 } })
      map.addLayer({ id: "hospitals", type: "circle", source: "hospitals", paint: { "circle-radius": 6, "circle-color": "#ffffff", "circle-stroke-color": "#C83A2A", "circle-stroke-width": 3 } })
      map.addLayer({ id: "shelters", type: "circle", source: "shelters", paint: { "circle-radius": 7, "circle-color": ["interpolate", ["linear"], ["get", "ratio"], 0, "#8DB596", 0.8, "#E5A11F", 1, "#C83A2A"] as never, "circle-stroke-color": "#0b0b0b", "circle-stroke-width": 2 } })
      map.addLayer({ id: "closures", type: "circle", source: "closures", paint: { "circle-radius": 8, "circle-color": "#C83A2A", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } })
      map.addLayer({ id: "closures-x", type: "symbol", source: "closures", layout: { "text-field": "×", "text-size": 16, "text-allow-overlap": true }, paint: { "text-color": "#ffffff" } })
      map.addLayer({ id: "incidents", type: "circle", source: "incidents", paint: { "circle-radius": ["+", 5, ["*", 1.6, ["get", "severity"]]] as never, "circle-color": ["case", ["==", ["get", "status"], "resolved"], "#5a5a5a", SEV_COLOR] as never, "circle-opacity": ["case", ["==", ["get", "status"], "resolved"], 0.5, 0.9] as never, "circle-stroke-color": ["case", ["==", ["get", "status"], "open"], "#ffffff", "#1c1b19"] as never, "circle-stroke-width": 2 } })
      map.addLayer({ id: "units", type: "circle", source: "units", paint: { "circle-radius": 7, "circle-color": UNIT_COLOR as never, "circle-stroke-color": "#0b0b0b", "circle-stroke-width": 2 } })
      map.addLayer({ id: "units-label", type: "symbol", source: "units", layout: { "text-field": ["get", "id"], "text-size": 10, "text-offset": [0, 1.3], "text-anchor": "top", "text-allow-overlap": false }, paint: { "text-color": "#eceae4", "text-halo-color": "#0b0b0b", "text-halo-width": 1.2 } })
      map.addLayer({ id: "me", type: "circle", source: "me", paint: { "circle-radius": 8, "circle-color": "#3B82F6", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } })

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "qadr-pop", offset: 12 })
      const hover = (layer: string, html: (p: Record<string, unknown>) => string) => {
        map.on("mousemove", layer, (e) => {
          map.getCanvas().style.cursor = "pointer"
          const f = e.features?.[0]
          if (!f) return
          popup.setLngLat(e.lngLat).setHTML(html(f.properties as Record<string, unknown>)).addTo(map)
        })
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; popup.remove() })
      }
      hover("incidents", (p) => `<b>${esc(String(p.title))}</b><div class="row">Severity ${p.severity} of 5 · ${p.people} people · ${esc(String(p.status))}</div><div class="row muted">Built from ${p.reports} report(s); trust ${Number(p.trust).toFixed(2)} (≥0.72 auto-confirms)</div>`)
      hover("units", (p) => `<b>${esc(String(p.label))}</b> <span class="muted">${esc(String(p.agency))}</span><div class="row">${esc(String(p.status).replace("_", " "))}${p.task ? ` → ${esc(String(p.task))}` : ""}</div>${p.eta ? `<div class="row muted">ETA ${Math.round(Number(p.eta))} min</div>` : ""}`)
      hover("shelters", (p) => `<b>${esc(String(p.name))}</b><div class="row">${p.occupancy} of ${p.capacity} places used (${Math.round(Number(p.ratio) * 100)}%)</div><div class="row muted">Relief camp · colour turns amber at 80%, red at capacity</div>`)
      hover("hospitals", (p) => `<b>${esc(String(p.name))}</b><div class="row muted">Hospital · receives medical evacuations</div>`)
      hover("closures", (p) => `<b>Road closed</b><div class="row">${esc(String(p.name))}</div><div class="row muted">${esc(String(p.note ?? ""))} · routes avoid it where the router allows</div>`)
      hover("sites", (p) => `<b>${esc(String(p.name))}</b><div class="row muted">${p.selected ? "Staging post chosen by QAOA" : "Candidate staging post"}</div>`)
      hover("routes", (p) => `<b>${esc(String(p.label))}</b><div class="row muted">${esc(String(p.engine))}${p.warn ? " · passes a reported closure" : ""}</div>`)

      for (const [layer, kind] of [["incidents", "incident"], ["units", "unit"], ["shelters", "shelter"], ["sites", "site"]] as const) {
        map.on("click", layer, (e) => {
          const f = e.features?.[0]
          if (f) { e.preventDefault(); pickRef.current?.(kind, String(f.properties?.id), [e.lngLat.lng, e.lngLat.lat]) }
        })
      }
      map.on("click", (e) => { if (!e.defaultPrevented) pickRef.current?.("map", "", [e.lngLat.lng, e.lngLat.lat]) })
      setReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setData = React.useCallback((id: string, data: FeatureCollection) => {
    const src = mapRef.current?.getSource(id) as mapboxgl.GeoJSONSource | undefined
    src?.setData(data)
  }, [])

  React.useEffect(() => {
    if (!ready) return
    setData("risk", fc((props.risk ?? []).filter((c) => c.level).map((c) => ({
      type: "Feature", properties: { level: c.level, risk: c.risk },
      geometry: { type: "Polygon", coordinates: [[[c.lng - c.dlon / 2, c.lat - c.dlat / 2], [c.lng + c.dlon / 2, c.lat - c.dlat / 2], [c.lng + c.dlon / 2, c.lat + c.dlat / 2], [c.lng - c.dlon / 2, c.lat + c.dlat / 2], [c.lng - c.dlon / 2, c.lat - c.dlat / 2]]] },
    }))))
  }, [ready, props.risk, setData])
  React.useEffect(() => {
    if (!ready) return
    setData("coverage", fc((props.coverage ?? []).map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circle(c.pos, c.km)] } }))))
  }, [ready, props.coverage, setData])
  React.useEffect(() => { if (ready) setData("sites", fc((props.sites ?? []).map((s) => pt(s.pos, { id: s.id, name: s.name, selected: s.selected })))) }, [ready, props.sites, setData])
  React.useEffect(() => { if (ready) setData("samples", fc((props.samples ?? []).map((p, i) => pt(p, { id: i })))) }, [ready, props.samples, setData])
  React.useEffect(() => { if (ready) setData("incidents", fc((props.incidents ?? []).map((i) => pt(i.pos, { id: i.id, title: i.title, severity: i.severity, status: i.status, people: i.people, trust: i.trust, reports: i.reports })))) }, [ready, props.incidents, setData])
  React.useEffect(() => { if (ready) setData("units", fc((props.units ?? []).map((u) => pt(u.pos, { id: u.id, label: u.label, status: u.status, agency: u.agency, task: u.task ?? "", eta: u.eta ?? 0 })))) }, [ready, props.units, setData])
  React.useEffect(() => { if (ready) setData("shelters", fc((props.shelters ?? []).map((s) => pt(s.pos, { id: s.id, name: s.name, capacity: s.capacity, occupancy: s.occupancy, ratio: s.occupancy / s.capacity })))) }, [ready, props.shelters, setData])
  React.useEffect(() => { if (ready) setData("hospitals", fc((props.hospitals ?? []).map((h) => pt(h.pos, { id: h.id, name: h.name })))) }, [ready, props.hospitals, setData])
  React.useEffect(() => { if (ready) setData("closures", fc((props.closures ?? []).map((c) => pt(c.pos, { id: c.id, name: c.name, note: c.note ?? "" })))) }, [ready, props.closures, setData])
  React.useEffect(() => {
    if (!ready) return
    setData("routes", fc((props.routes ?? []).filter((r) => r.path.length > 1).map((r) => ({ type: "Feature", properties: { id: r.id, kind: r.kind, label: r.label, engine: r.engine, warn: !!r.warn }, geometry: { type: "LineString", coordinates: r.path } }))))
  }, [ready, props.routes, setData])
  React.useEffect(() => {
    if (!ready) return
    const h = props.highlight
    setData("highlight", fc(h && h.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: h } }] : []))
  }, [ready, props.highlight, setData])
  React.useEffect(() => { if (ready) setData("me", fc(props.me ? [pt(props.me, {})] : [])) }, [ready, props.me, setData])
  React.useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !props.fit || props.fit.points.length === 0) return
    const b = new mapboxgl.LngLatBounds(props.fit.points[0], props.fit.points[0])
    props.fit.points.forEach((p) => b.extend(p))
    map.fitBounds(b, { padding: 60, maxZoom: 14, duration: 900 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.fit?.key])

  if (!env.mapboxToken) {
    return (
      <div className={cn("flex min-h-72 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground", className)}>
        Map needs a Mapbox token. Add <code className="mx-1 rounded bg-muted px-1">VITE_MAPBOX_TOKEN=pk…</code> to <code className="mx-1 rounded bg-muted px-1">.env</code> (or the Vercel project settings) and reload.
      </div>
    )
  }
  return <div ref={box} className={cn("min-h-72 w-full overflow-hidden rounded-lg", className)} />
}
