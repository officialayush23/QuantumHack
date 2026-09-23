/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** Guided tour: coach marks anchored to real parts of the screen.
 *
 *  A stranger should be able to open any screen cold and know what every panel is for. Each
 *  screen passes its own steps; wrap the matching region in <TourAnchor id=…>. Opens once per
 *  screen on first visit, and again from the Guide button.
 */

export interface TourStep {
  id: string
  title: string
  body: string
  side?: "top" | "right" | "bottom" | "left"
}

interface TourState {
  steps: TourStep[]
  active: string | null
  index: number
  start: () => void
  next: () => void
  back: () => void
  stop: () => void
}

const TourContext = React.createContext<TourState | null>(null)

export function TourProvider({ steps, storageKey, children }: { steps: TourStep[]; storageKey: string; children: React.ReactNode }) {
  const [index, setIndex] = React.useState(-1)
  const stop = React.useCallback(() => {
    setIndex(-1)
    try { localStorage.setItem(`qadr-tour:${storageKey}`, "1") } catch { /* storage unavailable */ }
  }, [storageKey])
  React.useEffect(() => {
    let done = false
    try { done = localStorage.getItem(`qadr-tour:${storageKey}`) === "1" } catch { /* ignore */ }
    if (done) return undefined
    const t = setTimeout(() => setIndex(0), 1400)
    return () => clearTimeout(t)
  }, [storageKey])
  const value: TourState = {
    steps,
    active: index >= 0 && index < steps.length ? steps[index].id : null,
    index,
    start: () => setIndex(0),
    next: () => setIndex((i) => (i + 1 < steps.length ? i + 1 : -1)),
    back: () => setIndex((i) => Math.max(0, i - 1)),
    stop,
  }
  return (
    <TourContext.Provider value={value}>
      {children}
      {value.active && <div className="fixed inset-0 z-40 bg-black/50" aria-hidden />}
    </TourContext.Provider>
  )
}

export function useTour() {
  return React.useContext(TourContext)
}

export function TourAnchor({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const tour = useTour()
  const ref = React.useRef<HTMLDivElement>(null)
  const step = tour?.steps.find((s) => s.id === id)
  const open = !!tour && tour.active === id
  React.useEffect(() => { if (open) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }) }, [open])
  if (!tour || !step) return <div className={className}>{children}</div>
  const last = tour.index === tour.steps.length - 1
  return (
    <Popover open={open} onOpenChange={(o) => !o && tour.stop()}>
      <PopoverAnchor asChild>
        <div ref={ref} className={cn(className, open && "relative z-50 rounded-xl ring-2 ring-primary ring-offset-4 ring-offset-background")}>{children}</div>
      </PopoverAnchor>
      <PopoverContent side={step.side ?? "bottom"} align="start" className="w-80" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-primary">Guide · {tour.index + 1} / {tour.steps.length}</span>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={tour.stop}>Skip</button>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">{step.title}</p>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={tour.back} disabled={tour.index === 0}>Back</Button>
            <Button size="sm" onClick={last ? tour.stop : tour.next}>{last ? "Done" : "Next"}</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
