import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { pct, siteCoverage, type Scenario } from "@/lib/qadr"

interface Props {
  scenario: Scenario
  selection: number[]
  previous: number[]
}

export function PlanTable({ scenario, selection, previous }: Props) {
  const removed = previous.filter((id) => !selection.includes(id))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment plan</CardTitle>
        <CardDescription>
          {selection.length} units · {previous.length ? `${selection.filter((id) => !previous.includes(id)).length} moved since last plan` : "first plan"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staging post</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Lat, lng</TableHead>
              <TableHead className="text-right">Risk it covers</TableHead>
              <TableHead className="text-right">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selection.map((id) => {
              const s = scenario.candidates[id]
              const isNew = previous.length > 0 && !previous.includes(id)
              return (
                <TableRow key={id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="capitalize">{s.region}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {s.lat.toFixed(3)}, {s.lng.toFixed(3)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{pct(siteCoverage(scenario, id))}</TableCell>
                  <TableCell className="text-right">
                    {isNew ? <Badge>New</Badge> : previous.length ? <Badge variant="secondary">Kept</Badge> : <Badge variant="outline">Placed</Badge>}
                  </TableCell>
                </TableRow>
              )
            })}
            {removed.map((id) => (
              <TableRow key={`rm-${id}`} className="text-muted-foreground">
                <TableCell className="line-through">{scenario.candidates[id].name}</TableCell>
                <TableCell className="capitalize">{scenario.candidates[id].region}</TableCell>
                <TableCell className="font-mono">
                  {scenario.candidates[id].lat.toFixed(3)}, {scenario.candidates[id].lng.toFixed(3)}
                </TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">Withdrawn</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
