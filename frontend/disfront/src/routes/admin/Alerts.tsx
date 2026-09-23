import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { clock, useWorld } from "@/store/world"
import type { AlertMsg } from "@/store/types"


const TEMPLATES = [
  { title: "Move to higher ground", body: "Budameru is overflowing. Residents of Ajit Singh Nagar and Payakapuram: move to the nearest relief camp now. / బుడమేరు పొంగుతోంది. సమీప సహాయ శిబిరానికి వెంటనే వెళ్లండి.", area: "Ajit Singh Nagar, Payakapuram" },
  { title: "Avoid Eluru Road", body: "Eluru Road at Ramavarappadu is closed by flooding. Use alternative routes. / రామవరప్పాడు వద్ద ఏలూరు రోడ్డు మూసివేయబడింది.", area: "Vijayawada city" },
  { title: "Delta villages: prepare to evacuate", body: "Krishna flow is rising downstream. Keep documents and medicines ready; boats are staged at Avanigadda and Challapalli. / కృష్ణా ప్రవాహం పెరుగుతోంది.", area: "Avanigadda, Challapalli, Koduru" },
]

export default function Alerts() {
  const alerts = useWorld((s) => s.alerts)
  const sendAlert = useWorld((s) => s.sendAlert)
  const [title, setTitle] = React.useState(TEMPLATES[0].title)
  const [body, setBody] = React.useState(TEMPLATES[0].body)
  const [area, setArea] = React.useState(TEMPLATES[0].area)
  const [channels, setChannels] = React.useState<string[]>(["sms", "app"])
  return (
    <>
      <PageHeader title="Public alerts" description="What residents are told, and on which channel." />
      <TourAnchor id="al-compose">
        <Card>
          <CardHeader><CardTitle>New alert</CardTitle><CardDescription>Demo: sending records the alert and shows it in the citizen app; SMS and siren gateways connect through the backend.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Template</Label>
              <Select onValueChange={(v) => { const t = TEMPLATES[Number(v)]; setTitle(t.title); setBody(t.body); setArea(t.area) }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Start from a template" /></SelectTrigger>
                <SelectContent>{TEMPLATES.map((t, i) => <SelectItem key={i} value={String(i)}>{t.title}</SelectItem>)}</SelectContent>
              </Select>
              <Label htmlFor="al-title">Headline</Label>
              <Input id="al-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Label htmlFor="al-area">Area</Label>
              <Input id="al-area" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="al-body">Message</Label>
              <Textarea id="al-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
              <Label>Channels</Label>
              <ToggleGroup type="multiple" variant="outline" size="sm" value={channels} onValueChange={setChannels}>
                <ToggleGroupItem value="sms">SMS</ToggleGroupItem>
                <ToggleGroupItem value="app">App</ToggleGroupItem>
                <ToggleGroupItem value="siren">Siren</ToggleGroupItem>
                <ToggleGroupItem value="radio">Radio</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardContent>
          <CardFooter>
            <Button disabled={!title || !channels.length} onClick={() => { sendAlert({ title, body, area, channels: channels as AlertMsg["channels"], lang: "both" }); toast.success(`Alert issued to ${area}.`) }}>Issue alert</Button>
          </CardFooter>
        </Card>
      </TourAnchor>
      <TourAnchor id="al-list">
        <Card size="sm">
          <CardHeader><CardTitle>Issued</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {alerts.length === 0 && <p className="text-muted-foreground">No alerts issued yet.</p>}
            {alerts.map((a) => (
              <div key={a.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{a.title}</span><span className="text-muted-foreground">· {a.area} · {clock(a.at)}</span>{a.channels.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}</div>
                <p className="mt-1 text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </TourAnchor>
    </>
  )
}
