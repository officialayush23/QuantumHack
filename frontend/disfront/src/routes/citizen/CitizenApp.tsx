import * as React from "react"
import { toast } from "sonner"
import { AlertTriangle, CircleHelp, HeartHandshake, LocateFixed, Navigation, Siren, WifiOff } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TourAnchor, TourProvider, useTour, type TourStep } from "@/components/common/tour"
import { PersonaSwitcher } from "@/components/layout/PersonaSwitcher"
import { MapView } from "@/components/map/MapView"
import { hospitalsF, useWorldLayers } from "@/components/map/layers"
import { CATEGORY, type Category } from "@/data/region"
import { distToPath, fmtKm, fmtMin, km, type LngLat } from "@/lib/geo"
import { ENGINE_LABEL, getRoute, type Route } from "@/lib/routing"
import { riskAt } from "@/lib/qadr"
import { useWorld } from "@/store/world"
import type { CitizenReportInput } from "@/store/types"

const T = {
  en: { title: "Flood help · Krishna district", where: "Your location", use: "Use my location", pick: "Tap the map to set your location", risk: "Flood risk here", shelter: "Nearest relief camp", route: "Walking route", help: "I need help", safe: "I am safe", my: "My reports", send: "Send report", what: "What is happening?", people: "People with you", note: "Anything else (landmark, floor, medical need)", photo: "I can share a photo", offline: "No signal. Your report is saved on this phone and goes the moment there is signal." },
  te: { title: "వరద సహాయం · కృష్ణా జిల్లా", where: "మీ స్థానం", use: "నా స్థానం వాడండి", pick: "మ్యాప్‌పై మీ స్థానాన్ని ఎంచుకోండి", risk: "ఇక్కడ వరద ప్రమాదం", shelter: "సమీప సహాయ శిబిరం", route: "నడక మార్గం", help: "నాకు సహాయం కావాలి", safe: "నేను సురక్షితంగా ఉన్నాను", my: "నా నివేదికలు", send: "పంపండి", what: "ఏం జరుగుతోంది?", people: "మీతో ఉన్నవారు", note: "ఇంకా ఏమైనా (గుర్తు, అంతస్తు, వైద్య అవసరం)", photo: "ఫోటో పంపగలను", offline: "సిగ్నల్ లేదు. మీ నివేదిక ఫోన్‌లో ఉంది, సిగ్నల్ రాగానే వెళ్తుంది." },
}
const RISK_WORD = (r: number) => (r >= 0.85 ? "Severe" : r >= 0.66 ? "High" : r >= 0.48 ? "Moderate" : r >= 0.3 ? "Low" : "Minimal")
const DEMO_HOME: LngLat = [80.629, 16.537] // Ajit Singh Nagar

const STEPS: TourStep[] = [
  { id: "ct-alert", title: "Official alert", body: "The latest alert from the district control room, in English and Telugu.", side: "bottom" },
  { id: "ct-loc", title: "Your location", body: "Share your location or tap the map. Nothing is sent until you press a report button.", side: "bottom" },
  { id: "ct-map", title: "Map", body: "Flood risk around you, relief camps (green to red as they fill), hospitals and closed roads. The green line is your walking route to the nearest camp.", side: "top" },
  { id: "ct-help", title: "Ask for help", body: "Say what is happening and how many people are with you. It reaches the same queue the control room works from, even if you have no signal right now.", side: "top" },
]

const reporterKey = () => {
  try {
    let k = localStorage.getItem("qadr-reporter")
    if (!k) { k = `c-${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem("qadr-reporter", k) }
    return k
  } catch { return "c-anon" }
}

function Citizen() {
  const [lang, setLang] = React.useState<"en" | "te">("en")
  const t = T[lang]
  const tour = useTour()
  const L = useWorldLayers()
  const scenario = useWorld((s) => s.scenario)
  const alerts = useWorld((s) => s.alerts)
  const shelters = useWorld((s) => s.shelters)
  const closures = useWorld((s) => s.closures)
  const reports = useWorld((s) => s.reports)
  const incidents = useWorld((s) => s.incidents)
  const units = useWorld((s) => s.units)
  const fileReport = useWorld((s) => s.fileReport)
  const [me, setMe] = React.useState<LngLat>(DEMO_HOME)
  const [picking, setPicking] = React.useState(false)
  const [route, setRoute] = React.useState<Route | null>(null)
  const [open, setOpen] = React.useState(false)
  const [cat, setCat] = React.useState<Category>("stranded")
  const [people, setPeople] = React.useState(3)
  const [note, setNote] = React.useState("")
  const [photo, setPhoto] = React.useState(false)
  const [online, setOnline] = React.useState(typeof navigator === "undefined" ? true : navigator.onLine)
  const [mine, setMine] = React.useState<string[]>([])
  const [key] = React.useState(reporterKey)

  React.useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener("online", on); window.addEventListener("offline", off)
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off) }
  }, [])

  // store-and-forward outbox
  React.useEffect(() => {
    if (!online) return
    try {
      const q = JSON.parse(localStorage.getItem("qadr-outbox") ?? "[]") as CitizenReportInput[]
      if (!q.length) return
      localStorage.removeItem("qadr-outbox")
      q.forEach((r) => { const res = fileReport(r); setMine((m) => [res.reportId, ...m]) })
      toast.success(`${q.length} saved report(s) sent now that there is signal.`)
    } catch { /* ignore */ }
  }, [online, fileReport])

  const shelter = React.useMemo(() => shelters.filter((s) => s.occupancy < s.capacity || s.overflowApproved).slice().sort((a, b) => km(a.pos, me) - km(b.pos, me))[0], [shelters, me])
  React.useEffect(() => {
    if (!shelter) return
    let off = false
    void getRoute(me, shelter.pos, "walking", closures.map((c) => c.pos), 4.5).then((r) => { if (!off) setRoute(r) })
    return () => { off = true }
  }, [me, shelter, closures])
  const routeWarn = route && route.engine !== "mapbox" && closures.some((c) => distToPath(c.pos, route.path) < 0.3)
  const risk = scenario ? riskAt(scenario, me) : 0
  const alert = alerts[0]

  const locate = () => {
    if (!navigator.geolocation) { toast("Location is not available on this device. Tap the map instead."); return }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos: LngLat = [p.coords.longitude, p.coords.latitude]
        if (km(pos, [80.8, 16.35]) > 90) { toast("You are outside the Krishna district demo area, so a demo location in Ajit Singh Nagar is used."); setMe(DEMO_HOME) }
        else setMe(pos)
      },
      () => toast("Could not read your location. Tap the map to set it."),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const submit = () => {
    const input: CitizenReportInput = { source: "citizen", category: cat, people, pos: me, place: "Reported from the citizen app", text: note || CATEGORY[cat].label, photo, reporter: key }
    setOpen(false)
    if (!online) {
      try { const q = JSON.parse(localStorage.getItem("qadr-outbox") ?? "[]"); q.push(input); localStorage.setItem("qadr-outbox", JSON.stringify(q)) } catch { /* ignore */ }
      toast(t.offline)
      return
    }
    const res = fileReport(input)
    setMine((m) => [res.reportId, ...m])
    if (res.decision === "held") toast("Received. It is waiting for a person to check it, because nothing nearby confirms it yet.")
    else toast.success(res.decision === "merged" ? "Received. Others near you reported this too, so it is already being handled." : "Received. The control room sees it now and the plan is updating.")
    setNote(""); setPhoto(false)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-4 bg-background p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t.title}</h1>
          <p className="text-xs text-muted-foreground">Emergency: dial 112 · Disaster helpline: 1070</p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" size="sm" variant="outline" value={lang} onValueChange={(v) => v && setLang(v as "en" | "te")}>
            <ToggleGroupItem value="en">EN</ToggleGroupItem>
            <ToggleGroupItem value="te">తెలుగు</ToggleGroupItem>
          </ToggleGroup>
          {tour && <Button size="icon-sm" variant="ghost" onClick={tour.start} aria-label="Guide"><CircleHelp /></Button>}
        </div>
      </header>
      <PersonaSwitcher current="citizen" />
      {!online && <Alert><WifiOff /><AlertTitle>Offline</AlertTitle><AlertDescription>{t.offline}</AlertDescription></Alert>}

      <TourAnchor id="ct-alert">
        <Alert variant={alert ? "destructive" : "default"}>
          <AlertTriangle />
          <AlertTitle>{alert ? alert.title : scenario ? scenario.label : "No active alert"}</AlertTitle>
          <AlertDescription>{alert ? alert.body : "Follow official instructions. This app shows the nearest open relief camp and lets you ask for help."}</AlertDescription>
        </Alert>
      </TourAnchor>

      <TourAnchor id="ct-loc">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{t.where} <Badge variant={risk >= 0.66 ? "destructive" : "outline"}>{t.risk}: {RISK_WORD(risk)}</Badge></CardTitle>
            <CardDescription>{me[1].toFixed(4)}, {me[0].toFixed(4)}{picking ? ` · ${t.pick}` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={locate}><LocateFixed /> {t.use}</Button>
            <Button size="sm" variant={picking ? "default" : "ghost"} onClick={() => setPicking((p) => !p)}>{t.pick}</Button>
          </CardContent>
        </Card>
      </TourAnchor>

      <TourAnchor id="ct-map">
        <MapView className="h-80" center={me} zoom={12.5} risk={L.risk} shelters={L.shelters} hospitals={hospitalsF} closures={L.closures} me={me} highlight={route?.path}
          fit={route ? { key: `${me.join()}-${shelter?.id}`, points: [me, ...(shelter ? [shelter.pos] : [])] } : undefined}
          onPick={(kind, _id, pos) => { if (picking && kind === "map") { setMe(pos); setPicking(false) } }} />
      </TourAnchor>

      {shelter && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t.shelter}: {shelter.name}</CardTitle>
            <CardDescription>{route ? `${fmtKm(route.distanceKm)} · about ${fmtMin(route.durationMin)} on foot · ${ENGINE_LABEL[route.engine]}` : "Finding a route…"} · {shelter.capacity - shelter.occupancy} places free</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {routeWarn && <Badge variant="destructive">This route may pass a closed road. Ask officials on the way.</Badge>}
            <details>
              <summary className="cursor-pointer text-muted-foreground"><Navigation className="mr-1 inline size-3.5" />{t.route}</summary>
              <ol className="mt-2 list-decimal pl-5">{route?.steps.slice(0, 10).map((s, i) => <li key={i}>{s.instruction} ({fmtKm(s.distanceKm)})</li>)}</ol>
            </details>
          </CardContent>
        </Card>
      )}

      <TourAnchor id="ct-help" className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="destructive" className="h-16 text-base" onClick={() => setOpen(true)}><Siren /> {t.help}</Button>
        <Button size="lg" variant="outline" className="h-16 text-base" onClick={() => toast.success("Thank you. Marked safe; rescuers will not come to this location for you.")}><HeartHandshake /> {t.safe}</Button>
      </TourAnchor>

      {mine.length > 0 && (
        <Card size="sm">
          <CardHeader><CardTitle>{t.my}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {mine.map((id) => {
              const r = reports.find((x) => x.id === id)
              const inc = incidents.find((i) => i.id === r?.incidentId)
              const u = units.find((x) => inc?.unitIds.includes(x.id))
              return (
                <div key={id} className="rounded-xl border p-2.5">
                  <p className="font-medium">{r ? CATEGORY[r.category].label : "Report"}</p>
                  <p className="text-muted-foreground">
                    {!r ? "Sending…" : r.decision === "held" ? "Waiting for a person to check it." : !inc ? "Received." : inc.status === "resolved" ? "Help reached this location." : u ? `${u.label} is on the way${u.task ? `, about ${fmtMin(u.task.etaMin)}` : ""}.` : "In the queue; a unit will be assigned as soon as one is free."}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90svh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t.help}</SheetTitle>
            <SheetDescription>Sent with your location {me[1].toFixed(3)}, {me[0].toFixed(3)}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <Label>{t.what}</Label>
            <ToggleGroup type="single" variant="outline" value={cat} onValueChange={(v) => v && setCat(v as Category)} className="flex-wrap justify-start">
              {(Object.keys(CATEGORY) as Category[]).map((c) => <ToggleGroupItem key={c} value={c}>{lang === "te" ? CATEGORY[c].telugu : CATEGORY[c].label}</ToggleGroupItem>)}
            </ToggleGroup>
            <div className="flex items-center justify-between"><Label>{t.people}</Label><span className="font-mono">{people}</span></div>
            <Slider value={[people]} min={1} max={30} step={1} onValueChange={(v) => setPeople(v[0])} />
            <Label htmlFor="c-note">{t.note}</Label>
            <Textarea id="c-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            <div className="flex items-center gap-2"><Switch id="c-photo" checked={photo} onCheckedChange={setPhoto} /><Label htmlFor="c-photo">{t.photo}</Label></div>
          </div>
          <SheetFooter><Button size="lg" variant="destructive" onClick={submit}>{t.send}</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function CitizenApp() {
  return <TourProvider steps={STEPS} storageKey="citizen"><Citizen /></TourProvider>
}
