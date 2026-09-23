import type { TourStep } from "@/components/common/tour"

/** Guided-tour steps per admin screen. Each id matches a <TourAnchor id=…> on that screen. */

export const AFTER_TOUR: TourStep[] = [
  { id: "aa-bench", title: "Quantum vs classical, on screen", body: "Coverage of the six staging posts for each risk state: uniform spacing, greedy, exhaustive search (the optimum) and QAOA. No quantum advantage is claimed at this size.", side: "bottom" },
  { id: "aa-outcome", title: "How the event went", body: "Computed from this session's event: incidents cleared, time to commit a unit, people evacuated.", side: "top" },
  { id: "aa-gaps", title: "Known gaps", body: "What does not work yet, said out loud before anyone finds it.", side: "top" },
]

export const ALERTS_TOUR: TourStep[] = [
  { id: "al-compose", title: "Compose a public alert", body: "Pick the area and channels. Templates are written in English and Telugu; the citizen app shows the latest alert at the top.", side: "bottom" },
  { id: "al-list", title: "Issued alerts", body: "Everything sent, when and where, as the public record of what people were told.", side: "top" },
]

export const APPROVALS_TOUR: TourStep[] = [
  { id: "a-queue", title: "Waiting for an officer", body: "Actions the system will not take on its own. Each one names the delegation rule that stopped it and who may approve.", side: "bottom" },
  { id: "a-rules", title: "Delegation rules", body: "Inside a rule, actions issue themselves and the rule is shown. Outside it they stop here. Nothing issues because a model was confident.", side: "top" },
]

export const CONSOLE_TOUR: TourStep[] = [
  { id: "c-map", title: "Live map", body: "Risk cells from the model, incidents sized by severity, units coloured by status with their road routes, relief camps, hospitals and closed roads. Hover anything for what it is and where the number comes from.", side: "right" },
  { id: "c-layers", title: "Layers", body: "Switch the risk grid, the QAOA staging posts and their coverage, and the routes on or off.", side: "top" },
  { id: "c-kpi", title: "Where things stand", body: "Open incidents, the ones nobody is heading to yet, units in use and camps close to capacity.", side: "left" },
  { id: "c-needs", title: "Needs you", body: "Only things waiting for a human: approvals the delegation rules will not issue on their own, and reports held below the trust floor.", side: "left" },
  { id: "c-changes", title: "What the last re-plan changed", body: "Each change comes with its reason, and units that kept their job are listed too, because nothing moving is also a result.", side: "left" },
]

export const DISPATCH_TOUR: TourStep[] = [
  { id: "d-ledger", title: "The dispatch ledger", body: "Every unit on a job, why it was chosen, its road route and ETA, and which router produced the route. Nothing here is moved by hand: the solver assigns and this screen explains.", side: "bottom" },
  { id: "d-uncovered", title: "Demands nobody has", body: "Incidents with no unit on the way, with the reason: no free unit with the right capability, low trust, or waiting for an approval.", side: "top" },
  { id: "d-route", title: "Route detail", body: "Click a row to see the route on the map and the turn-by-turn steps the crew sees on their phone.", side: "left" },
]

export const FEEDS_TOUR: TourStep[] = [
  { id: "f-river", title: "River discharge", body: "GloFAS v4 modelled discharge of the Krishna at Prakasam Barrage and in the delta, 30 days back and 30 forward, fetched live from Open-Meteo.", side: "bottom" },
  { id: "f-rain", title: "Rainfall", body: "Hourly precipitation for Vijayawada, the input a flash flood on the Budameru responds to. This is real data, not part of the simulated event.", side: "top" },
]

export const HOW_TOUR: TourStep[] = [
  { id: "h-flow", title: "The loop", body: "Reports and feeds in; trust, clustering and risk; QAOA for where units wait, the dispatch solver for who goes where; approvals where the rules require them; and the loop runs again when anything changes.", side: "bottom" },
  { id: "h-claims", title: "Claims, each with its backing", body: "So a judge can check one rather than take six on trust.", side: "top" },
]

export const INCIDENTS_TOUR: TourStep[] = [
  { id: "i-table", title: "Incident queue", body: "Sorted by priority: severity squared, scaled by people at risk. The same weight the dispatch solver uses, so the order here is the order help is sent.", side: "bottom" },
]

export const QUANTUM_TOUR: TourStep[] = [
  { id: "q-scenario", title: "Risk state", body: "The same three moments as the live event. Each one is a new QUBO: which six staging posts cover the most risk-weighted exposure.", side: "bottom" },
  { id: "q-play", title: "Play the quantum re-plan", body: "Steps through all three risk states: the risk grid changes, QAOA samples placements (orange rings), and the chosen posts appear with their 11 km coverage.", side: "bottom" },
  { id: "q-map", title: "Placement map", body: "Candidate staging posts are real towns. Orange posts are QAOA's choice; circles are their coverage radius over the risk grid.", side: "right" },
  { id: "q-solver", title: "Solver", body: "QAOA on the simulator, QAOA on IBM hardware (needs the backend and an IBM Quantum account), or a classical baseline for comparison.", side: "left" },
  { id: "q-pipeline", title: "Hybrid pipeline", body: "Risk layer → QUBO → split into ≤20-qubit subproblems → QAOA sampling → decode and check exactly k posts.", side: "left" },
  { id: "q-tabs", title: "Inside the run", body: "Convergence of the classical optimiser, the bitstrings QAOA sampled, the QUBO matrix, the plan and the benchmark against greedy and exhaustive search.", side: "top" },
]

export const REPORTS_TOUR: TourStep[] = [
  { id: "r-list", title: "Every report as it arrived", body: "Citizen app, field crews, agencies and sensors come through one door. Each gets a trust score and one decision: opened an incident, merged into one, or held.", side: "bottom" },
  { id: "r-trust", title: "Why this trust score", body: "Click a report to see the six components. Official channels confirm at 0.55, life-safety reports at 0.35, everything else at 0.72.", side: "left" },
]

export const RESOURCES_TOUR: TourStep[] = [
  { id: "res-units", title: "Fleet", body: "Every unit, its agency, what it can do and where it is in its job. Take a unit out of service here and the plan re-solves around the gap.", side: "bottom" },
  { id: "res-camps", title: "Relief camps", body: "Occupancy against rated capacity. Evacuees are added as stranded incidents are cleared; admitting above capacity needs the Relief Officer.", side: "top" },
]
