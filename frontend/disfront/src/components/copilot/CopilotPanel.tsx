import * as React from "react"
import { Link } from "react-router-dom"
import { ArrowUp, Sparkles, Trash2, Wrench, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { dataMode } from "@/config/env"
import { SUGGESTIONS } from "@/lib/copilot"
import { cn } from "@/lib/utils"
import { useCopilot, type CopilotMsg } from "@/store/copilot"

/** Command copilot: a right-hand panel on every command screen (⌘K / Ctrl+K). */
export function CopilotPanel() {
  const { open, setOpen, msgs, busy, ask, clear } = useCopilot()
  const [q, setQ] = React.useState("")
  const end = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); useCopilot.getState().toggle() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  React.useEffect(() => { end.current?.scrollIntoView({ block: "end" }) }, [msgs.length, busy])

  const send = (text: string) => { void ask(text); setQ("") }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Command copilot</SheetTitle>
          <SheetDescription>
            Asks and acts on the live plan. Every answer lists the tools it called; approvals still go to an officer.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-4">
            {msgs.length === 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Try:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} size="sm" variant="outline" className="h-auto py-1.5 text-left whitespace-normal" onClick={() => send(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m) => <Bubble key={m.id} m={m} onNavigate={() => setOpen(false)} />)}
            {busy && <p className="animate-pulse text-xs text-muted-foreground">Calling tools…</p>}
            <div ref={end} />
          </div>
        </ScrollArea>
        <div className="flex flex-col gap-2 border-t p-3">
          {msgs.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {SUGGESTIONS.slice(0, 5).map((s) => (
                <Button key={s} size="xs" variant="ghost" className="shrink-0" onClick={() => send(s)} disabled={busy}>{s}</Button>
              ))}
            </div>
          )}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(q) }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask or instruct… e.g. why was Boat 2 sent?" aria-label="Ask the copilot" />
            <Button type="submit" size="icon" disabled={busy || !q.trim()} aria-label="Send"><ArrowUp /></Button>
            {msgs.length > 0 && <Button type="button" size="icon" variant="ghost" onClick={clear} aria-label="Clear conversation"><Trash2 /></Button>}
          </form>
          <p className="text-[11px] text-muted-foreground">
            {dataMode === "demo" ? "Demo: questions are matched to tools on this device, no model or network involved." : "Connected: an LLM chooses from the same tools."} ⌘K / Ctrl+K opens this anywhere.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Bubble({ m, onNavigate }: { m: CopilotMsg; onNavigate: () => void }) {
  if (m.role === "user") {
    return <div className="ml-8 self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{m.text}</div>
  }
  return (
    <div className="mr-4 flex flex-col gap-2 rounded-2xl rounded-bl-sm border bg-card px-3 py-2.5 text-sm">
      {m.tools && m.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {m.acted && <Badge className="gap-1"><Zap className="size-3" /> action taken</Badge>}
          {m.tools.map((t) => <Badge key={t} variant="outline" className="gap-1 font-mono text-[10px]"><Wrench className="size-3" />{t}</Badge>)}
        </div>
      )}
      <p className="leading-relaxed">{m.text}</p>
      {m.head && m.rows && m.rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr>{m.head.map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {m.rows.map((r, i) => (
                <tr key={i} className={cn("border-t", String(r[0]).includes("(ours)") && "bg-primary/10 font-medium")}>
                  {r.map((c, j) => <td key={j} className="px-2 py-1.5 align-top">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {m.links && m.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {m.links.map((l) => <Button key={l.to} asChild size="xs" variant="secondary"><Link to={l.to} onClick={onNavigate}>{l.label}</Link></Button>)}
        </div>
      )}
    </div>
  )
}
