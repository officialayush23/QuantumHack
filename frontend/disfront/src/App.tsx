import type { ReactNode } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { TourProvider, type TourStep } from "@/components/common/tour"
import { AdminShell } from "@/components/layout/AdminShell"
import { useSimDriver } from "@/components/map/layers"
import Agents from "@/routes/admin/Agents"
import AfterAction from "@/routes/admin/AfterAction"
import Alerts from "@/routes/admin/Alerts"
import Approvals from "@/routes/admin/Approvals"
import Console from "@/routes/admin/Console"
import Dispatch from "@/routes/admin/Dispatch"
import Feeds from "@/routes/admin/Feeds"
import HowItWorks from "@/routes/admin/HowItWorks"
import Incidents from "@/routes/admin/Incidents"
import Overview from "@/routes/admin/Overview"
import Quantum from "@/routes/admin/Quantum"
import Reports from "@/routes/admin/Reports"
import Resources from "@/routes/admin/Resources"
import { AGENTS_TOUR, AFTER_TOUR, OVERVIEW_TOUR, ALERTS_TOUR, APPROVALS_TOUR, CONSOLE_TOUR, DISPATCH_TOUR, FEEDS_TOUR, HOW_TOUR, INCIDENTS_TOUR, QUANTUM_TOUR, REPORTS_TOUR, RESOURCES_TOUR } from "@/routes/admin/tours"
import CitizenApp from "@/routes/citizen/CitizenApp"
import FieldApp from "@/routes/field/FieldApp"

const CLOCK_STEP: TourStep = { id: "clock", title: "Event clock", body: "Start the flood event, change its speed, or fast-forward to the Budameru surge (T+6 h) and delta flooding (T+12 h). The citizen and field apps run on the same clock.", side: "bottom" }

const ADMIN: { path: string; key: string; el: ReactNode; steps: TourStep[] }[] = [
  { path: "overview", key: "overview", el: <Overview />, steps: [CLOCK_STEP, ...OVERVIEW_TOUR] },
  { path: "agents", key: "agents", el: <Agents />, steps: AGENTS_TOUR },
  { path: "console", key: "console", el: <Console />, steps: CONSOLE_TOUR },
  { path: "dispatch", key: "dispatch", el: <Dispatch />, steps: DISPATCH_TOUR },
  { path: "approvals", key: "approvals", el: <Approvals />, steps: APPROVALS_TOUR },
  { path: "reports", key: "reports", el: <Reports />, steps: REPORTS_TOUR },
  { path: "quantum", key: "quantum", el: <Quantum />, steps: QUANTUM_TOUR },
  { path: "after-action", key: "after", el: <AfterAction />, steps: AFTER_TOUR },
  { path: "incidents", key: "incidents", el: <Incidents />, steps: INCIDENTS_TOUR },
  { path: "resources", key: "resources", el: <Resources />, steps: RESOURCES_TOUR },
  { path: "feeds", key: "feeds", el: <Feeds />, steps: FEEDS_TOUR },
  { path: "alerts", key: "alerts", el: <Alerts />, steps: ALERTS_TOUR },
  { path: "how", key: "how", el: <HowItWorks />, steps: HOW_TOUR },
]

/** Three interfaces, three URLs: residents on /citizen (no login), crews on /field, the control room on /admin. */
export function App() {
  useSimDriver()
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/overview" replace />} />
      <Route path="/citizen" element={<CitizenApp />} />
      <Route path="/field" element={<FieldApp />} />
      {ADMIN.map((r) => (
        <Route key={r.path} path={`/admin/${r.path}`} element={
          <TourProvider steps={r.steps} storageKey={r.key}>
            <AdminShell>{r.el}</AdminShell>
          </TourProvider>
        } />
      ))}
      <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
      <Route path="*" element={<Navigate to="/admin/overview" replace />} />
    </Routes>
  )
}

export default App
