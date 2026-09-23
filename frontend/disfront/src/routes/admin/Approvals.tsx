import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/common/bits"
import { TourAnchor } from "@/components/common/tour"
import { RULES } from "@/data/region"
import { clock, useWorld } from "@/store/world"


export default function Approvals() {
  const approvals = useWorld((s) => s.approvals)
  const decide = useWorld((s) => s.decide)
  const pending = approvals.filter((a) => a.status === "pending")
  const done = approvals.filter((a) => a.status !== "pending")
  return (
    <>
      <PageHeader title="Approvals" description="Actions that need a named officer under the district's delegation rules." />
      <TourAnchor id="a-queue" className="grid gap-4 md:grid-cols-2">
        {pending.length === 0 && <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nothing is waiting. Approvals appear when the plan needs a team from outside the district or a camp goes over capacity.</CardContent></Card>}
        {pending.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle>{a.title}</CardTitle>
              <CardDescription>Raised at {clock(a.at)}</CardDescription>
              <CardAction><Badge>{a.rule.id}</Badge></CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>{a.detail}</p>
              <p className="rounded-lg bg-muted p-2 text-xs">Rule {a.rule.id}: {a.rule.text}</p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button onClick={() => { decide(a.id, true); toast.success("Approved. The action is issued and the log carries your decision.") }}>Approve</Button>
              <Button variant="outline" onClick={() => { decide(a.id, false); toast("Declined. The plan continues without it.") }}>Decline</Button>
            </CardFooter>
          </Card>
        ))}
      </TourAnchor>
      <TourAnchor id="a-rules">
        <Card size="sm">
          <CardHeader><CardTitle>Delegation rules in force</CardTitle><CardDescription>Demo rules for the prototype; configured per district in deployment</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {Object.values(RULES).map((r) => <p key={r.id}><Badge variant="outline" className="mr-2">{r.id}</Badge>{r.text}</p>)}
          </CardContent>
        </Card>
      </TourAnchor>
      {done.length > 0 && (
        <Card size="sm">
          <CardHeader><CardTitle>Decided</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {done.map((a) => <p key={a.id}><Badge variant={a.status === "approved" ? "default" : "outline"} className="mr-2">{a.status}</Badge>{a.title} <span className="text-muted-foreground">at {clock(a.decidedAt ?? a.at)}</span></p>)}
          </CardContent>
        </Card>
      )}
    </>
  )
}
