import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { CATEGORY } from "@/data/region"
import { clock, TRUST, useWorld } from "@/store/world"
import type { Report } from "@/store/types"


const PARTS: { key: keyof Report["parts"]; label: string; weight: string }[] = [
  { key: "source", label: "Source credibility", weight: "0.22" },
  { key: "history", label: "Reporter history", weight: "0.18" },
  { key: "location", label: "Location plausibility (risk at that cell)", weight: "0.18" },
  { key: "corroboration", label: "Independent corroboration", weight: "0.22" },
  { key: "evidence", label: "Evidence (photo)", weight: "0.10" },
  { key: "anomaly", label: "Anomaly discount", weight: "× (1 − 0.7a)" },
]

export default function Reports() {
  const reports = useWorld((s) => s.reports)
  const [filter, setFilter] = React.useState<"all" | "held" | "opened" | "merged">("all")
  const [sel, setSel] = React.useState<string | null>(null)
  const list = reports.filter((r) => filter === "all" || r.decision === filter)
  const r = reports.find((x) => x.id === sel) ?? list[0]
  return (
    <>
      <PageHeader title="Reports" description="The layer underneath incidents: each message in its own words, the trust computed from it and the decision made.">
        <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="held">Held</ToggleGroupItem>
          <ToggleGroupItem value="opened">Opened</ToggleGroupItem>
          <ToggleGroupItem value="merged">Merged</ToggleGroupItem>
        </ToggleGroup>
      </PageHeader>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <TourAnchor id="r-list">
          <Card>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Report</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Trust</TableHead><TableHead>Decision</TableHead></TableRow></TableHeader>
                <TableBody>
                  {list.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No reports yet.</TableCell></TableRow>}
                  {list.map((x) => (
                    <TableRow key={x.id} onClick={() => setSel(x.id)} className="cursor-pointer" data-state={r?.id === x.id ? "selected" : undefined}>
                      <TableCell className="font-mono text-xs tabular-nums">{clock(x.at)}</TableCell>
                      <TableCell className="max-w-96 whitespace-normal">“{x.text}”<div className="text-xs text-muted-foreground">{CATEGORY[x.category].label} · {x.place}</div></TableCell>
                      <TableCell><Badge variant="outline">{x.source}</Badge></TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{x.trust.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={x.decision === "held" ? "destructive" : x.decision === "opened" ? "default" : "secondary"}>{x.decision}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TourAnchor>
        <TourAnchor id="r-trust">
          <Card size="sm">
            <CardHeader>
              <CardTitle>{r ? `Trust ${r.trust.toFixed(2)}` : "Trust breakdown"}</CardTitle>
              <CardDescription>{r ? `${r.corroborators} independent corroborator(s) within 1.5 km and 2 h` : "Select a report"}</CardDescription>
            </CardHeader>
            {r && (
              <CardContent className="flex flex-col gap-3 text-sm">
                {PARTS.map((p) => (
                  <div key={p.key} className="flex flex-col gap-1">
                    <div className="flex justify-between"><span>{p.label}</span><span className="font-mono text-xs text-muted-foreground">{r.parts[p.key].toFixed(2)} · w {p.weight}</span></div>
                    <Progress value={r.parts[p.key] * 100} />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Auto-confirm ≥ {TRUST.confirm} · official channels ≥ {TRUST.official} · quarantine &lt; {TRUST.floor}. Life-safety reports above the floor are confirmed: sending a boat to nobody wastes a boat, not sending one can cost a life.</p>
              </CardContent>
            )}
          </Card>
        </TourAnchor>
      </div>
    </>
  )
}
