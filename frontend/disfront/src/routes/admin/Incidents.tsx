import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PageHeader, SEVERITY_LABEL } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { CAPABILITY_LABEL, CATEGORY } from "@/data/region"
import { clock, useWorld } from "@/store/world"


export default function Incidents() {
  const incidents = useWorld((s) => s.incidents)
  const units = useWorld((s) => s.units)
  const [filter, setFilter] = React.useState<"active" | "all">("active")
  const list = incidents
    .filter((i) => filter === "all" || i.status !== "resolved")
    .slice()
    .sort((a, b) => b.severity ** 2 * (1 + b.people / 50) - a.severity ** 2 * (1 + a.people / 50))
  return (
    <>
      <PageHeader title="Incidents" description="Reports clustered by place and type. Ten calls about one street are one incident.">
        <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
          <ToggleGroupItem value="active">Active</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
      </PageHeader>
      <TourAnchor id="i-table">
        <Card>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Incident</TableHead><TableHead>Severity</TableHead><TableHead className="text-right">People</TableHead><TableHead>Needs</TableHead><TableHead>Units</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Reports</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No incidents yet.</TableCell></TableRow>}
                {list.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.title}<div className="text-xs text-muted-foreground">opened {clock(i.createdAt)}{i.resolvedAt ? ` · resolved ${clock(i.resolvedAt)}` : ""}</div></TableCell>
                    <TableCell><Badge variant={i.severity >= 4 ? "destructive" : "outline"}>{i.severity} · {SEVERITY_LABEL[i.severity]}</Badge></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{i.people}</TableCell>
                    <TableCell>{CAPABILITY_LABEL[CATEGORY[i.category].needs]}</TableCell>
                    <TableCell className="text-xs">{i.unitIds.map((id) => units.find((u) => u.id === id)?.label).join(", ") || "—"}</TableCell>
                    <TableCell><Badge variant={i.status === "open" ? "destructive" : i.status === "resolved" ? "outline" : "secondary"}>{i.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{i.reportIds.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TourAnchor>
    </>
  )
}
