import { FastForward, Pause, Play, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EVENT_END, SCENARIO_AT } from "@/data/region"
import { clock, useWorld } from "@/store/world"

/** The event clock. One minute of the flood per real second at 1×. */
export function SimControls({ compact = false }: { compact?: boolean }) {
  const minute = useWorld((s) => s.minute)
  const running = useWorld((s) => s.running)
  const speed = useWorld((s) => s.speed)
  const scenario = useWorld((s) => s.scenario)
  const { play, pause, setSpeed, jumpTo, reset } = useWorld.getState()
  const done = minute >= EVENT_END
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="font-mono tabular-nums">{clock(minute)}</Badge>
      {!compact && scenario && <Badge variant="secondary" className="hidden md:inline-flex">{scenario.label}</Badge>}
      {running ? (
        <Button size="sm" variant="outline" onClick={pause}><Pause /> Pause</Button>
      ) : (
        <Button size="sm" onClick={play} disabled={done}><Play /> {minute > 0 ? "Resume" : "Start event"}</Button>
      )}
      <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
        <SelectTrigger size="sm" className="w-20" aria-label="Simulation speed"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[1, 3, 6, 15, 30].map((s) => <SelectItem key={s} value={String(s)}>{s}×</SelectItem>)}
        </SelectContent>
      </Select>
      {!compact && SCENARIO_AT.slice(1).map((s) => (
        <Tooltip key={s.id}>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={() => jumpTo(s.at)} disabled={minute >= s.at}><FastForward /> {s.short}</Button>
          </TooltipTrigger>
          <TooltipContent>Fast-forward the event to {s.short}</TooltipContent>
        </Tooltip>
      ))}
      {!compact && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" variant="ghost" onClick={reset} aria-label="Reset the event"><RotateCcw /></Button>
          </TooltipTrigger>
          <TooltipContent>Reset to the opening position (demo only)</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
