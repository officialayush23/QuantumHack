/* eslint-disable react-refresh/only-export-components */
import { CheckCircle2, Circle, Loader2 } from "lucide-react"

import { Progress } from "@/components/ui/progress"

export const STAGES = ["Risk layer", "QUBO build", "Decompose ≤20 qubits", "QAOA sampling", "Decode + validate"] as const

interface Props {
  /** index of the stage in progress; STAGES.length when done; -1 when idle */
  active: number
  quantumLabel: string
}

export function PipelineStatus({ active, quantumLabel }: Props) {
  const value = active < 0 ? 0 : Math.min(100, (active / STAGES.length) * 100)
  return (
    <div className="flex flex-col gap-3">
      <Progress value={value} />
      <ol className="grid grid-cols-1 gap-1.5 text-sm">
        {STAGES.map((s, i) => {
          const done = active > i
          const running = active === i
          const label = i === 3 ? `QAOA on ${quantumLabel}` : s
          return (
            <li key={s} className="flex items-center gap-2">
              {done ? (
                <CheckCircle2 className="size-4 text-primary" />
              ) : running ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Circle className="size-4 text-muted-foreground" />
              )}
              <span className={done || running ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
