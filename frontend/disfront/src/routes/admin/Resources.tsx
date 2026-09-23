import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { CAPABILITY_LABEL } from "@/data/region"
import { fmtMin } from "@/lib/geo"
import { useWorld } from "@/store/world"


export default function Resources() {
  const units = useWorld((s) => s.units)
  const shelters = useWorld((s) => s.shelters)
  const fieldUpdate = useWorld((s) => s.fieldUpdate)
  return (
    <>
      <PageHeader title="Units & relief camps" description="What the district has, and how much of it is in use." />
      <TourAnchor id="res-units">
        <Card>
          <CardHeader><CardTitle>Fleet</CardTitle><CardDescription>{units.filter((u) => u.status !== "offline").length} of {units.length} in service</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Unit</TableHead><TableHead>Agency</TableHead><TableHead>Capabilities</TableHead><TableHead>Status</TableHead><TableHead className="text-right">ETA</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {units.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.label}<div className="text-xs text-muted-foreground">{u.crew}</div></TableCell>
                    <TableCell className="text-xs">{u.agency}{u.outsideDistrict && <Badge variant="secondary" className="ml-1">outside district</Badge>}</TableCell>
                    <TableCell className="text-xs">{u.capabilities.map((c) => CAPABILITY_LABEL[c]).join(", ")}</TableCell>
                    <TableCell><Badge variant={u.status === "offline" ? "destructive" : u.status === "available" || u.status === "staging" ? "outline" : "default"}>{u.task?.kind === "staging" ? "to staging" : u.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{u.task ? fmtMin(u.task.etaMin) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {u.status === "offline"
                        ? <Button size="xs" variant="outline" onClick={() => fieldUpdate(u.id, "available")}>Return to service</Button>
                        : <Button size="xs" variant="ghost" onClick={() => fieldUpdate(u.id, "offline")}>Take out of service</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TourAnchor>
      <TourAnchor id="res-camps">
        <Card>
          <CardHeader><CardTitle>Relief camps</CardTitle><CardDescription>{shelters.reduce((a, s) => a + s.occupancy, 0).toLocaleString()} people sheltered</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {shelters.map((s) => {
              const r = s.occupancy / s.capacity
              return (
                <div key={s.id} className="flex flex-col gap-1.5 rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">{s.name}</span>
                    <Badge variant={r >= 1 ? "destructive" : r >= 0.8 ? "secondary" : "outline"}>{Math.round(r * 100)}%</Badge></div>
                  <Progress value={Math.min(100, r * 100)} />
                  <span className="text-xs text-muted-foreground">{s.occupancy} of {s.capacity} places{s.overflowApproved ? " · overflow approved" : ""}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </TourAnchor>
    </>
  )
}
