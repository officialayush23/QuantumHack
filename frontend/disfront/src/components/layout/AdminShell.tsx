import * as React from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  Atom, BarChart3, CircleHelp, ClipboardCheck, Inbox, Menu, Network, Radar, Radio, Siren, Truck, Waves, Waypoints,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { TourAnchor, useTour } from "@/components/common/tour"
import { dataMode } from "@/config/env"
import { cn } from "@/lib/utils"
import { selectHeld, selectPending, selectUnattended, useWorld } from "@/store/world"
import { PersonaSwitcher } from "./PersonaSwitcher"
import { SimControls } from "./SimControls"

type Tone = "blocked" | "gap"
interface NavItem {
  to: string
  label: string
  icon: typeof Radar
  count?: () => { n: number; tone: Tone; what: string } | null
}

/** Grouped so the rail answers "where do I start": four screens run the event, the rest explain it.
 *  A badge means a person has to act, never "this page has content". */
function useNav(): { group: string; items: NavItem[] }[] {
  const pending = useWorld((s) => selectPending(s).length)
  const held = useWorld((s) => selectHeld(s).length)
  const unattended = useWorld((s) => selectUnattended(s).length)
  return [
    {
      group: "Operations",
      items: [
        { to: "/admin/console", label: "Live map", icon: Radar },
        { to: "/admin/dispatch", label: "Who is on what", icon: Waypoints, count: () => (unattended ? { n: unattended, tone: "gap", what: "incidents with nobody on the way" } : null) },
        { to: "/admin/approvals", label: "Approvals", icon: ClipboardCheck, count: () => (pending ? { n: pending, tone: "blocked", what: "waiting for an officer" } : null) },
        { to: "/admin/reports", label: "Reports", icon: Inbox, count: () => (held ? { n: held, tone: "blocked", what: "held below the trust floor" } : null) },
      ],
    },
    {
      group: "Quantum",
      items: [
        { to: "/admin/quantum", label: "Quantum planner", icon: Atom },
        { to: "/admin/after-action", label: "Benchmark & after-action", icon: BarChart3 },
      ],
    },
    {
      group: "Analysis",
      items: [
        { to: "/admin/incidents", label: "Incidents", icon: Siren },
        { to: "/admin/resources", label: "Units & relief camps", icon: Truck },
        { to: "/admin/feeds", label: "Live river & rain", icon: Waves },
        { to: "/admin/alerts", label: "Public alerts", icon: Radio },
        { to: "/admin/how", label: "How this works", icon: Network },
      ],
    },
  ]
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNav()
  return (
    <nav className="flex flex-col gap-5">
      {nav.map((g) => (
        <div key={g.group} className="flex flex-col gap-1">
          <p className="px-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{g.group}</p>
          {g.items.map((it) => {
            const c = it.count?.()
            return (
              <NavLink key={it.to} to={it.to} onClick={onNavigate}
                className={({ isActive }) => cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-muted", isActive && "bg-muted font-medium text-foreground")}>
                <it.icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{it.label}</span>
                {c && (
                  <Badge variant={c.tone === "blocked" ? "default" : "outline"} title={`${c.n} ${c.what}`}>{c.n}</Badge>
                )}
              </NavLink>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const tour = useTour()
  const loc = useLocation()
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-4 border-r p-4 lg:flex">
        <Brand />
        <Separator />
        <NavList />
        <div className="mt-auto text-xs text-muted-foreground">
          {dataMode === "demo" ? "Demo mode: the event runs in this browser from recorded QAOA results." : "Connected to the Q-ADR API."}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader className="p-0"><SheetTitle><Brand /></SheetTitle></SheetHeader>
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <TourAnchor id="clock"><SimControls /></TourAnchor>
          <div className="ml-auto flex items-center gap-2">
            <PersonaSwitcher current="admin" />
            {tour && <Button variant="ghost" size="sm" onClick={tour.start} key={loc.pathname}><CircleHelp /> Guide</Button>}
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Atom className="size-4" /></div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">Q-ADR</p>
        <p className="text-[11px] text-muted-foreground">Krishna basin command</p>
      </div>
    </div>
  )
}
