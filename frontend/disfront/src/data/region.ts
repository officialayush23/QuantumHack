import type { LngLat } from "@/lib/geo"

/** Operational demo data for the Krishna basin around Vijayawada.
 *
 *  Place names are real; coordinates are approximate and the facilities, units and reports are
 *  demo data for the prototype. Everything here is replaced by Supabase rows once the backend
 *  lands (see supabase/migrations/001_init.sql).
 */

export const REGION = {
  name: "Krishna basin · Vijayawada",
  center: [80.66, 16.4] as LngLat,
  zoom: 8.6,
  cityCenter: [80.648, 16.506] as LngLat,
  cityZoom: 11.6,
}

export type Capability = "boat" | "medical" | "rescue" | "pump" | "logistics"
export type Category = "stranded" | "medical" | "flooding" | "structure" | "supplies"

export const CATEGORY: Record<Category, { label: string; needs: Capability; lifeSafety: boolean; serviceMin: number; telugu: string }> = {
  stranded: { label: "People stranded", needs: "boat", lifeSafety: true, serviceMin: 45, telugu: "చిక్కుకున్నవారు" },
  medical: { label: "Medical emergency", needs: "medical", lifeSafety: true, serviceMin: 30, telugu: "వైద్య అత్యవసరం" },
  flooding: { label: "Street flooding", needs: "pump", lifeSafety: false, serviceMin: 60, telugu: "వీధి వరద" },
  structure: { label: "Building damage", needs: "rescue", lifeSafety: true, serviceMin: 50, telugu: "భవనం దెబ్బతింది" },
  supplies: { label: "Food / water needed", needs: "logistics", lifeSafety: false, serviceMin: 40, telugu: "ఆహారం / నీరు కావాలి" },
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  boat: "Rescue boat",
  medical: "Ambulance",
  rescue: "Search & rescue",
  pump: "Dewatering pump",
  logistics: "Relief truck",
}

export interface UnitSeed {
  id: string
  label: string
  agency: string
  capabilities: Capability[]
  speedKmh: number
  home: LngLat
  crew: string
}

/** Boats travel by road on trailers to the launch point, hence road speeds. */
export const UNITS: UnitSeed[] = [
  { id: "NDRF-B1", label: "NDRF Boat 1", agency: "NDRF 10 Bn", capabilities: ["boat", "rescue"], speedKmh: 35, home: [80.54, 16.62], crew: "Insp. R. Naidu" },
  { id: "NDRF-B2", label: "NDRF Boat 2", agency: "NDRF 10 Bn", capabilities: ["boat", "rescue"], speedKmh: 35, home: [80.545, 16.615], crew: "SI K. Varma" },
  { id: "NDRF-B3", label: "NDRF Boat 3", agency: "NDRF 10 Bn", capabilities: ["boat", "rescue"], speedKmh: 35, home: [80.55, 16.61], crew: "SI P. Reddy" },
  { id: "SDRF-B1", label: "SDRF Boat 1", agency: "AP SDRF", capabilities: ["boat"], speedKmh: 35, home: [80.62, 16.51], crew: "HC S. Rao" },
  { id: "SDRF-B2", label: "SDRF Boat 2", agency: "AP SDRF", capabilities: ["boat"], speedKmh: 35, home: [80.625, 16.505], crew: "HC M. Babu" },
  { id: "FIRE-1", label: "Fire & Rescue 1", agency: "AP Fire Services", capabilities: ["rescue", "pump"], speedKmh: 28, home: [80.64, 16.515], crew: "SFO V. Kumar" },
  { id: "FIRE-2", label: "Fire & Rescue 2", agency: "AP Fire Services", capabilities: ["rescue", "pump"], speedKmh: 28, home: [80.99, 16.43], crew: "SFO A. Prasad" },
  { id: "AMB-1", label: "108 Ambulance 1", agency: "EMRI 108", capabilities: ["medical"], speedKmh: 32, home: [80.623, 16.516], crew: "EMT L. Devi" },
  { id: "AMB-2", label: "108 Ambulance 2", agency: "EMRI 108", capabilities: ["medical"], speedKmh: 32, home: [80.69, 16.49], crew: "EMT J. Kiran" },
  { id: "AMB-3", label: "108 Ambulance 3", agency: "EMRI 108", capabilities: ["medical"], speedKmh: 32, home: [80.84, 16.365], crew: "EMT R. Sunitha" },
  { id: "AMB-4", label: "108 Ambulance 4", agency: "EMRI 108", capabilities: ["medical"], speedKmh: 32, home: [81.13, 16.18], crew: "EMT N. Ravi" },
  { id: "PUMP-1", label: "VMC Pump 1", agency: "Vijayawada Municipal Corp.", capabilities: ["pump"], speedKmh: 22, home: [80.635, 16.52], crew: "AE D. Srinivas" },
  { id: "PUMP-2", label: "VMC Pump 2", agency: "Vijayawada Municipal Corp.", capabilities: ["pump"], speedKmh: 22, home: [80.66, 16.5], crew: "AE G. Lakshmi" },
  { id: "TRUCK-1", label: "Relief Truck 1", agency: "Civil Supplies", capabilities: ["logistics"], speedKmh: 26, home: [80.6, 16.48], crew: "Driver B. Raju" },
  { id: "TRUCK-2", label: "Relief Truck 2", agency: "Civil Supplies", capabilities: ["logistics"], speedKmh: 26, home: [80.8, 16.54], crew: "Driver T. Mohan" },
  { id: "TRUCK-3", label: "Relief Truck 3", agency: "Civil Supplies", capabilities: ["logistics"], speedKmh: 26, home: [80.96, 16.33], crew: "Driver Y. Kumar" },
]

export interface ShelterSeed {
  id: string
  name: string
  pos: LngLat
  capacity: number
  occupancy: number
}

export const SHELTERS: ShelterSeed[] = [
  { id: "SH-1", name: "ZPHS Ajit Singh Nagar", pos: [80.628, 16.54], capacity: 600, occupancy: 180 },
  { id: "SH-2", name: "IGMC Stadium relief camp", pos: [80.631, 16.5125], capacity: 1500, occupancy: 420 },
  { id: "SH-3", name: "Siddhartha College, Moghalrajpuram", pos: [80.656, 16.507], capacity: 800, occupancy: 150 },
  { id: "SH-4", name: "KBN College, Kothapet", pos: [80.616, 16.513], capacity: 700, occupancy: 260 },
  { id: "SH-5", name: "ZPHS Gannavaram", pos: [80.8, 16.541], capacity: 500, occupancy: 60 },
  { id: "SH-6", name: "Penamaluru relief camp", pos: [80.72, 16.448], capacity: 400, occupancy: 90 },
  { id: "SH-7", name: "ZPHS Vuyyuru", pos: [80.845, 16.365], capacity: 450, occupancy: 40 },
  { id: "SH-8", name: "Avanigadda cyclone shelter", pos: [80.918, 16.022], capacity: 350, occupancy: 30 },
  { id: "SH-9", name: "Machilipatnam cyclone shelter", pos: [81.128, 16.186], capacity: 600, occupancy: 50 },
  { id: "SH-10", name: "Gudivada community hall", pos: [80.992, 16.432], capacity: 400, occupancy: 45 },
]

export const HOSPITALS: { id: string; name: string; pos: LngLat }[] = [
  { id: "H-1", name: "Government General Hospital, Vijayawada", pos: [80.6232, 16.5157] },
  { id: "H-2", name: "AIIMS Mangalagiri", pos: [80.548, 16.436] },
  { id: "H-3", name: "Area Hospital, Gudivada", pos: [80.995, 16.435] },
  { id: "H-4", name: "District Hospital, Machilipatnam", pos: [81.135, 16.183] },
]

export type Source = "citizen" | "field" | "agency" | "sensor"

export interface ScriptReport {
  at: number
  source: Source
  category: Category
  people: number
  pos: LngLat
  place: string
  text: string
  photo?: boolean
  reporter?: string
}

export type ScriptItem =
  | { at: number; kind: "scenario"; id: "t0" | "t6" | "t12" }
  | ({ kind: "report" } & ScriptReport)
  | { at: number; kind: "closure"; pos: LngLat; reason: string; by: string }

/** The event, minute by minute. Same door as a human report: everything goes through intake. */
export const SCRIPT: ScriptItem[] = [
  { at: 0, kind: "scenario", id: "t0" },
  { at: 20, kind: "report", source: "sensor", category: "flooding", people: 0, pos: [80.627, 16.534], place: "Ajit Singh Nagar", text: "Water-level sensor: 0.6 m on the main road" },
  { at: 45, kind: "report", source: "citizen", category: "flooding", people: 40, pos: [80.64, 16.548], place: "Payakapuram", text: "Knee-deep water entering houses near the canal", photo: true, reporter: "c-201" },
  { at: 80, kind: "report", source: "citizen", category: "supplies", people: 120, pos: [80.616, 16.528], place: "Rajarajeswari Peta", text: "No drinking water since morning, 30 families" , reporter: "c-202" },
  { at: 130, kind: "report", source: "field", category: "flooding", people: 0, pos: [80.633, 16.498], place: "Ranigari Thota", text: "Low-lying lane flooded along Krishna bund" },
  { at: 170, kind: "report", source: "citizen", category: "medical", people: 1, pos: [80.622, 16.535], place: "Ajit Singh Nagar", text: "Elderly man with chest pain, cannot walk out", reporter: "c-203" },
  { at: 220, kind: "report", source: "agency", category: "supplies", people: 300, pos: [80.72, 16.448], place: "Penamaluru", text: "Relief camp asks for 300 food packets" },
  { at: 290, kind: "report", source: "citizen", category: "flooding", people: 25, pos: [80.685, 16.522], place: "Ramavarappadu", text: "Service road under water", reporter: "c-204" },
  { at: 360, kind: "scenario", id: "t6" },
  { at: 375, kind: "report", source: "citizen", category: "stranded", people: 6, pos: [80.625, 16.54], place: "Ajit Singh Nagar", text: "Family of six on the terrace, water at first floor", photo: true, reporter: "c-205" },
  { at: 385, kind: "report", source: "citizen", category: "stranded", people: 6, pos: [80.626, 16.541], place: "Ajit Singh Nagar", text: "Neighbours stuck on roof, children with them", reporter: "c-206" },
  { at: 395, kind: "report", source: "field", category: "stranded", people: 14, pos: [80.64, 16.552], place: "Payakapuram", text: "Around 14 people cut off in two buildings" },
  { at: 420, kind: "closure", pos: [80.683, 16.524], reason: "Eluru Road under 1 m of water at Ramavarappadu", by: "FIRE-1" },
  { at: 430, kind: "report", source: "citizen", category: "medical", people: 1, pos: [80.66, 16.575], place: "Nunna", text: "Pregnant woman needs hospital, road cut off", reporter: "c-207" },
  { at: 460, kind: "report", source: "citizen", category: "stranded", people: 9, pos: [80.6, 16.56], place: "Jakkampudi", text: "Colony surrounded by water, 9 people", reporter: "c-208" },
  // a burst from one phone in a low-risk area with the same text: the anomaly discount should hold it
  ...[470, 472, 474, 476, 478, 480].map((at) => ({ at, kind: "report" as const, source: "citizen" as const, category: "flooding" as const, people: 50, pos: [80.43, 16.78] as LngLat, place: "Mylavaram hills", text: "Huge flood here!! send help", reporter: "c-900" })),
  { at: 500, kind: "report", source: "field", category: "structure", people: 3, pos: [80.59, 16.53], place: "Bhavanipuram", text: "Compound wall collapse, people trapped" },
  { at: 540, kind: "report", source: "citizen", category: "supplies", people: 200, pos: [80.628, 16.54], place: "ZPHS Ajit Singh Nagar", text: "Camp needs milk and baby food" , reporter: "c-209" },
  { at: 600, kind: "report", source: "citizen", category: "stranded", people: 4, pos: [80.645, 16.545], place: "Payakapuram", text: "Old couple and two kids on first floor", reporter: "c-210" },
  { at: 720, kind: "scenario", id: "t12" },
  { at: 735, kind: "report", source: "agency", category: "stranded", people: 22, pos: [80.93, 16.115], place: "Challapalli", text: "Revenue dept: 22 people stranded in low-lying fields" },
  { at: 760, kind: "report", source: "citizen", category: "stranded", people: 8, pos: [80.92, 16.03], place: "Avanigadda", text: "Houses near the river bank flooded, 8 people", reporter: "c-211" },
  { at: 790, kind: "report", source: "citizen", category: "supplies", people: 150, pos: [80.96, 16.33], place: "Pamarru", text: "Village cut off, needs food and water" , reporter: "c-212" },
  { at: 810, kind: "report", source: "field", category: "medical", people: 2, pos: [80.95, 16.17], place: "Ghantasala", text: "Two injured, need ambulance" },
  { at: 840, kind: "report", source: "citizen", category: "flooding", people: 60, pos: [80.99, 15.99], place: "Koduru", text: "Water rising in the fishing hamlet", reporter: "c-213" },
  { at: 870, kind: "report", source: "citizen", category: "stranded", people: 5, pos: [80.92, 15.95], place: "Nagayalanka", text: "Family stranded, boat needed", reporter: "c-214" },
]

export const SCENARIO_AT: { id: "t0" | "t6" | "t12"; at: number; short: string }[] = [
  { id: "t0", at: 0, short: "T0" },
  { id: "t6", at: 360, short: "T+6 h" },
  { id: "t12", at: 720, short: "T+12 h" },
]
export const EVENT_END = 900

/** Delegation rules that decide whether an action issues itself or waits for a named officer.
 *  Demo rules for the prototype; configured per district in the real deployment. */
export const RULES = {
  outsideTeam: { id: "D-3", text: "Requisitioning a team from outside the district requires the District Collector." },
  overCapacity: { id: "D-5", text: "Admitting people above a camp's rated capacity requires the Relief Officer." },
  inDistrict: { id: "D-1", text: "In-district units may be dispatched by the EOC without further approval." },
}
