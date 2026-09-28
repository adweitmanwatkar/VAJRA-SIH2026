/* ============================================================
   VAJRA — Domain model
   Data model: User, DesignCase, Location, ClimateProfile,
   ClimatePoint, Shelter, Material, Simulation, SimulationResult,
   CandidateDesign, Comparison, Recommendation, Report
   ============================================================ */

export type ID = string

export type ClimateKind = 'representative' | 'live' | 'uploaded'

export interface ClimatePoint {
  /** ISO-like timestamp, hour-resolution, e.g. '2024-01-15T13:00' */
  t: string
  /** Ambient dry-bulb temperature, °C */
  temp: number
  /** Relative humidity, % */
  rh: number
  /** Global horizontal solar irradiance, W/m² */
  ghi: number
  /** Wind speed at 10 m, m/s */
  wind: number
}

export interface ClimateProfile {
  id: ID
  name: string
  locationId: ID
  kind: ClimateKind
  source: string
  /** e.g. 'NASA POWER 2023 (cached)' */
  sourceNote: string
  resolution: 'hourly'
  points: ClimatePoint[]
  cachedAt: number | null
  provenance: string
}

export interface LocationInfo {
  id: ID
  name: string
  region: string
  country: string
  lat: number
  lon: number
  elevationM: number
  climateZone: string
  /** short descriptor used in demo scenarios */
  descriptor: string
}

export type MaterialCategory = 'wall' | 'roof' | 'floor' | 'insulation'

export interface Material {
  id: ID
  name: string
  category: MaterialCategory[]
  /** kg/m³ */
  density: number
  /** W/(m·K) */
  conductivity: number
  /** J/(kg·K) */
  specificHeat: number
  /** default layer thickness, m */
  thickness: number
  /** non-null for custom materials */
  isReference: boolean
  note: string
}

export type ShelterShape = 'rectangular' | 'quonset' | 'domed'

export type Orientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export interface Shelter {
  lengthM: number
  widthM: number
  heightM: number
  shape: ShelterShape
  orientation: Orientation
  occupants: number
  /** W sensible heat per occupant (seated-light ~ 75 W, moderate ~ 120 W) */
  activity: 'resting' | 'seated-light' | 'moderate'
  /** additional internal equipment load, W */
  internalLoadW: number
  windowCount: number
  /** total window area, m² */
  windowAreaM2: number
  /** total door area, m² */
  doorAreaM2: number
  /** air changes per hour from openings/infiltration */
  ach: number
  wallMaterialId: ID
  roofMaterialId: ID
  floorMaterialId: ID
  insulationMaterialId: ID
  /** insulation layer thickness, m */
  insulationThicknessM: number
  /** extra exposed thermal mass capacity, J/K (e.g. sandbags, water drums) */
  extraThermalMassJk: number
}

export type SimulationStatus = 'draft' | 'running' | 'complete' | 'failed'

export interface ComfortSettings {
  /** comfort band lower bound, °C */
  minC: number
  /** comfort band upper bound, °C */
  maxC: number
  /** run PMV/PPD alongside the band criterion */
  pmvEnabled: boolean
}

export interface SimulationSettings {
  /** number of days simulated from the climate profile start */
  days: number
  timestepMin: number
  comfort: ComfortSettings
}

export interface DesignCase {
  id: ID
  name: string
  createdAt: number
  updatedAt: number
  locationId: ID
  climateProfileId: ID
  shelter: Shelter
  settings: SimulationSettings
  status: SimulationStatus
}

export interface EnvelopeLayers {
  /** U-value, W/(m²·K) */
  u: number
  /** areal heat capacity, J/(m²·K) */
  arealCapacity: number
  /** total opaque thickness, m */
  thickness: number
  layers: { name: string; thicknessM: number; uContrib: number }[]
}

export interface SeriesPoint {
  t: string
  hour: number
  day: number
  tempOut: number
  tempIn: number
  /** W */
  solarGain: number
  /** W, positive = loss to outside */
  conduction: number
  /** W */
  ventilation: number
  /** W */
  internal: number
  /** stored in thermal mass, W (positive = charging) */
  storage: number
  /** W/m² incident on envelope */
  solarIncident: number
  comfort: ComfortState
  /** normalized 0..1 for storage bar */
  tempInNorm: number
}

export interface ComfortState {
  /** 'below' | 'in' | 'above' relative to the comfort band */
  band: 'below' | 'in' | 'above'
  /** optional PMV value for this hour */
  pmv: number | null
  ppd: number | null
}

export interface SimulationResult {
  id: ID
  designCaseId: ID
  ranAt: number
  status: SimulationStatus
  error?: string
  /** configuration snapshot used (deterministic reruns) */
  configSnapshot: { shelter: Shelter; settings: SimulationSettings; climateProfileId: ID; locationId: ID }
  /** aggregated KPIs */
  metrics: {
    avgTempInC: number
    minTempInC: number
    maxTempInC: number
    avgTempOutC: number
    comfortHours: number
    totalHours: number
    comfortPct: number
    /** kWh over the simulated window */
    solarGainKWh: number
    conductionKWh: number
    ventilationKWh: number
    internalGainKWh: number
    /** estimated auxiliary thermal energy demand to hold the comfort band, kWh */
    auxDemandKWh: number
    /** mean U-value of opaque envelope, W/m²K */
    meanU: number
    /** envelope heat capacity used, J/K */
    thermalCapacity: number
    /** ventilation rate */
    ach: number
    /** free-float peak exceedance above band, °C·h */
    overheatCh: number
    /** °C·h below band */
    underheatCh: number
    avgPpd: number | null
  }
  series: SeriesPoint[]
  envelope: { wall: EnvelopeLayers; roof: EnvelopeLayers; floor: EnvelopeLayers; insulation: EnvelopeLayers | null }
}

export interface CandidateDesign {
  id: ID
  designCaseId: ID
  name: string
  color: string
  shelter: Shelter
  settings: SimulationSettings
  result: SimulationResult | null
}

export interface ComparisonEntry {
  label: string
  unit: string
  values: (number | string)[]
  higherIsBetter: boolean
  decimals: number
}

export interface Comparison {
  id: ID
  designCaseId: ID
  createdAt: number
  candidateIds: ID[]
  entries: ComparisonEntry[]
  bestCandidateId: ID | null
  rationale: string[]
}

export interface Recommendation {
  candidateId: ID
  headline: string
  reasons: string[]
  tradeoffs: string[]
  metrics: ComparisonEntry[]
}

export interface OptimizationReport {
  id: ID
  designCaseId: ID
  ranAt: number
  objective: string
  evaluated: number
  feasible: number
  bestCandidate: CandidateDesign
  ranking: { candidateId: ID; name: string; score: number; comfortPct: number; auxKWh: number; feasible: boolean }[]
  constraintNotes: string[]
  recommendation: Recommendation
}

export interface ReportModel {
  id: ID
  designCaseId: ID
  createdAt: number
  sections: ReportSection[]
  simulationId: ID
  comparisonId: ID | null
}

export interface ReportSection {
  id: string
  title: string
  body: string
}
