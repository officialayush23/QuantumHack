import * as React from "react"
import { toast } from "sonner"
import { Ban, CheckCircle2, CircleHelp, MapPin, Megaphone, PhoneCall, PowerOff, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TourAnchor, TourProvider, useTour, type TourStep } from "@/components/common/tour"
import { PersonaSwitcher } from "@/components/layout/PersonaSwitcher"
import { SimControls } from "@/components/layout/SimControls"
import { MapView } from "@/components/map/MapView"
import { useWorldLayers } from "@/components/map/layers"
import { CATEGORY, type Category } from "@/data/region"
import { fmtKm, fmtMin, remaining } from "@/lib/geo"
import { ENGINE_LABEL } from "@/lib/routing"
import { useWorld } from "@/store/world"

const STEPS: TourStep[] = [
  { id: "ft-crew", title: "Which crew you are", body: "Demo sign-in: pick a unit. In deployment this comes from the crew's Supabase account.", side: "bottom" },
  { id: "ft-task", title: "Your job", body: "Where to go, why you were chosen, the ETA and the road route. The route says which router produced it.", side: "bottom" },
  { id: "ft-actions", title: "Tell the control room", body: "Status changes re-plan the district immediately. Report a blocked road and every route through it is recomputed.", side: "top" },
  { id: "ft-map", title: "Map", body: "Your route in green, other incidents, and closed roads.", side: "top" },
]

function Field() {
  const tour = useTour()
  const units = useWorld((s) => s.units)
  const incidents = useWorld((s) => s.incidents)
  const { fieldUpdate, blockRoad, fileReport } = useWorld.getState()
  const L = useWorldLayers()
  const [unitId, setUnitId] = React.useState(() => { try { return localStorage.getItem("qadr-crew") ?? "NDRF-B1" } catch { return "NDRF-B1" } })
  const [cat, setCat] = React.useState<Category>("stranded")
  const [note, setNote] = React.useState("")
  React.useEffect(() => { try { localStorage.setItem("qadr-crew", unitId) } catch { /* ignore */ } }, [unitId])
  const u = units.find((x) => x.id === unitId) ?? units[0]
  const task = u.task
  const inc = task?.kind === "incident" ? incidents.find((i) => i.id === task.targetId) : undefined
  const onScene = incidents.find((i) => i.unitIds.includes(u.id) && i.status === "on_scene")

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-4 bg-background p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Field crew · Q-ADR</h1>
          <p className="text-xs text-muted-foreground">Krishna district EOC · radio channel 3</p>
        </div>
        {tour && <Button size="icon-sm" variant="ghost" onClick={tour.start} aria-label="Guide"><CircleHelp /></Button>}
      </header>
      <PersonaSwitcher current="field" />
      <SimControls compact />

      <TourAnchor id="ft-crew">
        <Select value={u.id} onValueChange={setUnitId}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{units.map((x) => <SelectItem key={x.id} value={x.id}>{x.label} · {x.crew}</SelectItem>)}</SelectContent>
        </Select>
      </TourAnchor>

      <TourAnchor id="ft-task">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {inc ? inc.title : task?.kind === "staging" ? `Move to staging post: ${task.targetId.replace("site:", "")}` : onScene ? `On scene: ${onScene.title}` : "No job right now"}
              <Badge variant={u.status === "offline" ? "destructive" : "outline"}>{task?.kind === "staging" ? "to staging" : u.status.replace("_", " ")}</Badge>
            </CardTitle>
            <CardDescription>{task ? `${fmtKm(task.lengthKm - task.progressKm)} · ETA ${fmtMin(task.etaMin)} · ${ENGINE_LABEL[task.engine]}` : "Stay at your post. You will be tasked here the moment you are needed."}</CardDescription>
          </CardHeader>
          {task && (
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="rounded-xl bg-muted p-2.5"><span className="font-medium">Why you: </span>{task.reason}</p>
              {inc && <p className="flex items-center gap-2"><Users className="size-4" /> {inc.people} people · severity {inc.severity} · {CATEGORY[inc.category].label}</p>}
              {task.passesClosure && <Badge variant="destructive">Route passes a reported closure: confirm with control</Badge>}
              <ol className="list-decimal pl-5">{task.steps.slice(0, 8).map((s, i) => <li key={i}>{s.instruction} <span className="text-muted-foreground">({fmtKm(s.distanceKm)})</span></li>)}</ol>
            </CardContent>
          )}
        </Card>
      </TourAnchor>

      <TourAnchor id="ft-actions" className="grid grid-cols-2 gap-2">
        <Button disabled={!inc} onClick={() => { fieldUpdate(u.id, "on_scene"); toast.success("Marked on scene. The control room sees it now.") }}><MapPin /> On scene</Button>
        <Button variant="secondary" disabled={!onScene} onClick={() => { fieldUpdate(u.id, "resolved"); toast.success("Job closed. You are available for the next one.") }}><CheckCircle2 /> Job done</Button>
        <Button variant="outline" disabled={!inc && !onScene} onClick={() => { fieldUpdate(u.id, "backup"); toast("Backup requested: severity raised and the plan is re-solving.") }}><PhoneCall /> Need backup</Button>
        <Button variant="outline" onClick={() => { blockRoad(u.pos, `Road blocked, reported by ${u.label}`, u.id); toast("Closure recorded. Routes through it are being recomputed.") }}><Ban /> Road blocked here</Button>
        {u.status === "offline"
          ? <Button variant="outline" className="col-span-2" onClick={() => fieldUpdate(u.id, "available")}>Back in service</Button>
          : <Button variant="ghost" className="col-span-2" onClick={() => { fieldUpdate(u.id, "offline"); toast("Out of service. Your job goes back to the planner.") }}><PowerOff /> Out of service</Button>}
      </TourAnchor>

      <TourAnchor id="ft-map">
        <MapView className="h-80" center={u.pos} zoom={12} incidents={L.incidents} closures={L.closures} units={L.units.filter((x) => x.id === u.id)} shelters={L.shelters}
          highlight={task ? remaining(task.path, task.progressKm) : undefined} fit={task ? { key: `${u.id}-${task.assignedAt}`, points: task.path } : { key: u.id, points: [u.pos] }} />
      </TourAnchor>

      <Card size="sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="size-4" /> Report what you see</CardTitle><CardDescription>Field reports carry high trust and confirm at 0.55</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ToggleGroup type="single" variant="outline" size="sm" value={cat} onValueChange={(v) => v && setCat(v as Category)} className="flex-wrap justify-start">
            {(Object.keys(CATEGORY) as Category[]).map((c) => <ToggleGroupItem key={c} value={c}>{CATEGORY[c].label}</ToggleGroupItem>)}
          </ToggleGroup>
          <Label htmlFor="f-note">Details</Label>
          <Textarea id="f-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 12 people on a rooftop behind the temple" />
          <Button onClick={() => { const r = fileReport({ source: "field", category: cat, people: 5, pos: u.pos, place: `near ${u.label}`, text: note || CATEGORY[cat].label, photo: true, reporter: u.id }); toast.success(`Report ${r.decision} (trust ${r.trust.toFixed(2)}).`); setNote("") }}>Send field report</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function FieldApp() {
  return <TourProvider steps={STEPS} storageKey="field"><Field /></TourProvider>
}
