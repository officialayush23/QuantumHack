/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Info } from "lucide-react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Three things about every number: what it is, where it comes from, what to do with it. */
export function Explain({ what, source, meaning, className }: { what: string; source: string; meaning?: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={cn("inline-flex text-muted-foreground hover:text-foreground", className)} aria-label={`About: ${what}`}>
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <p className="font-medium">{what}</p>
        <p className="opacity-80">Source: {source}</p>
        {meaning && <p className="opacity-80">{meaning}</p>}
      </TooltipContent>
    </Tooltip>
  )
}

export function Kpi({ label, value, hint, tone, explain }: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: "default" | "warn" | "bad" | "good"
  explain?: { what: string; source: string; meaning?: string }
}) {
  const color = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : tone === "good" ? "text-emerald-500" : ""
  return (
    <Card size="sm" className="gap-1">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          {label}
          {explain && <Explain {...explain} />}
        </CardDescription>
        <CardTitle className={cn("font-mono text-2xl tabular-nums", color)}>{value}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  )
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export const SEVERITY_LABEL = ["", "Minor", "Moderate", "Serious", "Severe", "Critical"]

export function useNow(ms = 1000) {
  const [n, setN] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return n
}
