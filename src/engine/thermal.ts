import type {
  ClimateProfile,
  ComfortState,
  LocationInfo,
  Material,
  SeriesPoint,
  Shelter,
  SimulationResult,
  SimulationSettings,
} from '../domain/types'
import { buildAssemblies, exteriorFilm, type Assemblies } from './envelope'
import { splitSolar } from './solar'

/* ==================================================================
   VAJRA reduced-order thermal model (prototype)

   Single-zone transient RC heat balance, explicit Euler (dt default
   5 min, sub-steps within each climate hour):

     C_total · dTin/dt = Q_solar + Q_internal − Q_cond − Q_vent

     Q_solar    : transmitted window solar + absorbed opaque gains
     Q_internal : occupants (sensible) + equipment
     Q_cond     : Σ U_i · A_i · (Tin − T_eff)   (envelope, openings, floor)
     Q_vent     : ρ·cp·V̇ · (Tin − Tout)          (ACH-driven)
     C_total    : air capacity + coupled envelope mass + extra mass

     T_eff = sol-air temperature = Tout + (α·I_incident)/h_out

   Deterministic: identical inputs always produce identical results.
   No random numbers are used anywhere in this engine.
   ================================================================== */

const RHO_AIR = 1.2 // kg/m³
const CP_AIR = 1005 // J/(kg·K)
const SOLAR_ABS_WALL = 0.6 // shortwave absorptivity, opaque wall
const SOLAR_ABS_ROOF = 0.75
const WINDOW_SHGC = 0.55 // reference single-glazing transmittance
const WINDOW_U = 5.8 // W/m²K reference glazing
const DOOR_U = 3.5 // W/m²K reference door leaf
const GROUND_OFFSET = -2 // ground runs slightly colder than mean ambient

export interface EngineInput {
  shelter: Shelter
  settings: SimulationSettings
  profile: ClimateProfile
  location: LocationInfo
  materials: Material[]
}

export interface EngineOutput {
  series: SeriesPoint[]
  metrics: SimulationResult['metrics']
  assemblies: Assemblies
  areas: {
    wallAreaM2: number
    roofAreaM2: number
    floorAreaM2: number
    windowAreaM2: number
    doorAreaM2: number
    volumeM3: number
  }
}

export function occupantWatts(activity: Shelter['activity']): number {
  switch (activity) {
    case 'resting': return 70
    case 'seated-light': return 100
    case 'moderate': return 145
  }
}

export function metFromActivity(a: Shelter['activity']): number {
  switch (a) {
    case 'resting': return 0.8
    case 'seated-light': return 1.2
    case 'moderate': return 2.0
  }
}

/** effective ACH including wind-driven infiltration through openings */
export function effectiveAch(shelter: Shelter, windMs: number): number {
  const base = Math.max(0.2, shelter.ach)
  const openness = shelter.windowCount > 0 || shelter.doorAreaM2 > 0 ? 1.4 : 0.4
  const windEffect = Math.min(3.5, (windMs / 4) * openness)
  return base + windEffect
}

export function geometryAreas(s: Shelter): EngineOutput['areas'] {
  const perimeter = 2 * (s.lengthM + s.widthM)
  const wallArea = perimeter * s.heightM
  const floorRoofArea = s.lengthM * s.widthM
  const windowArea = Math.min(s.windowAreaM2, wallArea * 0.4)
  const doorArea = Math.min(s.doorAreaM2, wallArea * 0.2)
  const volume = s.lengthM * s.widthM * s.heightM
  return {
    wallAreaM2: wallArea,
    roofAreaM2: floorRoofArea,
    floorAreaM2: floorRoofArea,
    windowAreaM2: windowArea,
    doorAreaM2: doorArea,
    volumeM3: volume,
  }
}

interface UaNetwork {
  uaOpaque: number
  uaOpenings: number
  uaFloor: number
  tGround: number
  capacity: number
  assemblies: Assemblies
}

function buildNetwork(input: EngineInput): { area: EngineOutput['areas']; net: UaNetwork } {
  const { shelter, profile, materials } = input
  const area = geometryAreas(shelter)
  const assemblies = buildAssemblies(shelter, materials)
  const airCapacity = RHO_AIR * CP_AIR * area.volumeM3
  const envelopeCapacity =
    (assemblies.wall.arealCapacity * area.wallAreaM2 +
      assemblies.roof.arealCapacity * area.roofAreaM2 +
      assemblies.floor.arealCapacity * area.floorAreaM2) *
    0.35 // only part of envelope mass tracks air temperature closely
  const capacity = airCapacity + envelopeCapacity + Math.max(0, shelter.extraThermalMassJk)

  const uaOpaque = assemblies.wall.u * area.wallAreaM2 + assemblies.roof.u * area.roofAreaM2
  const uaOpenings = WINDOW_U * area.windowAreaM2 + DOOR_U * area.doorAreaM2
  const uaFloor = assemblies.floor.u * area.floorAreaM2
  const annualMean = profile.points.reduce((a, p) => a + p.temp, 0) / Math.max(1, profile.points.length)
  const tGround = annualMean + GROUND_OFFSET

  return { area, net: { uaOpaque, uaOpenings, uaFloor, tGround, capacity, assemblies } }
}

interface HourFluxes {
  qWindow: number
  qWallAbs: number
  qRoofAbs: number
  internalGain: number
  tSolWall: number
  tSolRoof: number
  ventWPerK: number
  tOut: number
}

function hourFluxes(input: EngineInput, area: EngineOutput['areas'], hourIdx: number, uaWall: number, uaRoof: number): HourFluxes {
  const { shelter, profile, location } = input
  const point = profile.points[hourIdx]
  const hOut = exteriorFilm(point.wind)
  const solar = splitSolar(point, location.lat, shelter.orientation)
  const tSolWall = point.temp + (SOLAR_ABS_WALL * solar.wall) / hOut
  const tSolRoof = point.temp + (SOLAR_ABS_ROOF * solar.roof) / hOut
  const qWindow = WINDOW_SHGC * area.windowAreaM2 * solar.wall
  // Opaque-surface solar absorption is captured through the sol-air
  // temperature used in conduction (tSolWall/tSolRoof) — adding a separate
  // "absorbed" term would double-count the same energy. Only glazing
  // transmits solar directly into the air node.
  const qWallAbs = 0
  const qRoofAbs = 0
  const internalGain = occupantWatts(shelter.activity) * shelter.occupants + shelter.internalLoadW
  const ach = effectiveAch(shelter, point.wind)
  const ventWPerK = (RHO_AIR * CP_AIR * area.volumeM3 * ach) / 3600
  return { qWindow, qWallAbs, qRoofAbs, internalGain, tSolWall, tSolRoof, ventWPerK, tOut: point.temp }
}


/**
 * Free-floating transient simulation (no HVAC).
 */
export function runFreeFloat(input: EngineInput): {
  series: SeriesPoint[]
  aggregates: {
    solarKWh: number; condKWh: number; ventKWh: number; internalKWh: number
    comfortHours: number; overheatCh: number; underheatCh: number
    ppdSum: number; ppdCount: number
    temps: number[]
  }
} {
  const { area, net } = buildNetwork(input)
  const { shelter, settings, profile } = input
  const hours = Math.min(settings.days * 24, profile.points.length)
  const dtMin = Math.max(1, settings.timestepMin)
  const dt = dtMin * 60
  const substeps = Math.max(1, Math.round(3600 / dt))
  const lo = settings.comfort.minC
  const hi = settings.comfort.maxC

  let tempIn = initialTempEstimate(input, net)
  const series: SeriesPoint[] = []
  let solarKWh = 0, condKWh = 0, ventKWh = 0, internalKWh = 0
  let comfortHours = 0, overheatCh = 0, underheatCh = 0, ppdSum = 0, ppdCount = 0
  const temps: number[] = []

  for (let h = 0; h < hours; h++) {
    const point = profile.points[h]
    const f = hourFluxes(input, area, h, net.assemblies.wall.u, net.assemblies.roof.u)
    const tSolMid = 0.5 * (f.tSolWall + f.tSolRoof)

    for (let s = 0; s < substeps; s++) {
      const conduction =
        net.uaOpaque * (tempIn - tSolMid) +
        net.uaOpenings * (tempIn - f.tOut) +
        net.uaFloor * (tempIn - net.tGround)
      const ventilation = f.ventWPerK * (tempIn - f.tOut)
      const qNet = f.qWindow + f.qWallAbs + f.qRoofAbs + f.internalGain - conduction - ventilation
      tempIn += (qNet * dt) / net.capacity
      tempIn = Math.min(70, Math.max(-40, tempIn))
    }

    const conductionOut =
      net.uaOpaque * (tempIn - tSolMid) +
      net.uaOpenings * (tempIn - f.tOut) +
      net.uaFloor * (tempIn - net.tGround)
    const ventilationOut = f.ventWPerK * (tempIn - f.tOut)
    const storage = f.qWindow + f.qWallAbs + f.qRoofAbs + f.internalGain - conductionOut - ventilationOut

    const band: ComfortState['band'] = tempIn < lo ? 'below' : tempIn > hi ? 'above' : 'in'
    const pmv = pmvApprox(tempIn, point.rh, metFromActivity(shelter.activity))
    const ppd = pmvToPpd(pmv)

    solarKWh += (f.qWindow + f.qWallAbs + f.qRoofAbs) / 1000
    condKWh += Math.max(0, conductionOut) / 1000
    ventKWh += Math.max(0, ventilationOut) / 1000
    internalKWh += f.internalGain / 1000
    if (band === 'in') comfortHours += 1
    if (tempIn > hi) overheatCh += tempIn - hi
    if (tempIn < lo) underheatCh += lo - tempIn
    ppdSum += ppd
    ppdCount += 1
    temps.push(tempIn)

    series.push({
      t: point.t,
      hour: h % 24,
      day: Math.floor(h / 24) + 1,
      tempOut: point.temp,
      tempIn: r1(tempIn),
      solarGain: Math.round(f.qWindow + f.qWallAbs + f.qRoofAbs),
      conduction: Math.round(Math.max(0, conductionOut)),
      ventilation: Math.round(Math.max(0, ventilationOut)),
      internal: Math.round(f.internalGain),
      storage: Math.round(storage),
      solarIncident: Math.round(point.ghi),
      comfort: { band, pmv: r2(pmv), ppd: r2(ppd) },
      tempInNorm: 0,
    })
  }

  return {
    series,
    aggregates: { solarKWh, condKWh, ventKWh, internalKWh, comfortHours, overheatCh, underheatCh, ppdSum, ppdCount, temps },
  }
}

/**
 * Quasi-steady initial interior temperature: ambient window mean plus
 * the internal-gain equilibrium offset (Q_internal / UA_total). Avoids
 * burning the first days of the window on capacitive warm-up and makes
 * short windows representative of the steady response.
 */
function initialTempEstimate(input: EngineInput, net: UaNetwork): number {
  const { area } = { area: geometryAreas(input.shelter) }
  const hours = Math.min(input.settings.days * 24, input.profile.points.length)
  const window = input.profile.points.slice(0, Math.max(1, hours))
  const tOutMean = window.reduce((a, p) => a + p.temp, 0) / window.length
  const windMean = window.reduce((a, p) => a + p.wind, 0) / window.length
  const ventWPerK = (RHO_AIR * CP_AIR * area.volumeM3 * effectiveAch(input.shelter, windMean)) / 3600
  const uaTotal = net.uaOpaque + net.uaOpenings + net.uaFloor + ventWPerK
  const qInternal = occupantWatts(input.shelter.activity) * input.shelter.occupants + input.shelter.internalLoadW
  const t0 = tOutMean + qInternal / Math.max(1, uaTotal)
  return Math.min(45, Math.max(-35, t0))
}

/**
 * Auxiliary energy demand: second deterministic pass with an ideal
 * heater/cooler clamping Tin to the comfort band. The energy the ideal
 * system must supply/remove is the estimated thermal energy demand.
 */
export function runAuxDemand(input: EngineInput): { auxKWh: number; heatKWh: number; coolKWh: number } {
  const { area, net } = buildNetwork(input)
  const { settings, profile } = input
  const hours = Math.min(settings.days * 24, profile.points.length)
  const dt = Math.max(1, settings.timestepMin) * 60
  const substeps = Math.max(1, Math.round(3600 / dt))
  const lo = settings.comfort.minC
  const hi = settings.comfort.maxC

  let tempIn = initialTempEstimate(input, net)
  let heatKWh = 0
  let coolKWh = 0

  for (let h = 0; h < hours; h++) {
    const f = hourFluxes(input, area, h, net.assemblies.wall.u, net.assemblies.roof.u)
    const tSolMid = 0.5 * (f.tSolWall + f.tSolRoof)
    for (let s = 0; s < substeps; s++) {
      const conduction =
        net.uaOpaque * (tempIn - tSolMid) +
        net.uaOpenings * (tempIn - f.tOut) +
        net.uaFloor * (tempIn - net.tGround)
      const ventilation = f.ventWPerK * (tempIn - f.tOut)
      let qNet = f.qWindow + f.qWallAbs + f.qRoofAbs + f.internalGain - conduction - ventilation

      const dT = (qNet * dt) / net.capacity
      let next = tempIn + dT
      if (next < lo) {
        // dT already reflects one substep — energy = C·ΔT (no further division)
        heatKWh += ((lo - next) * net.capacity) / 3.6e6
        next = lo
      } else if (next > hi) {
        coolKWh += ((next - hi) * net.capacity) / 3.6e6
        next = hi
      }
      tempIn = Math.min(70, Math.max(-40, next))
    }
  }
  return { auxKWh: heatKWh + coolKWh, heatKWh, coolKWh }
}

export function runSimulation(input: EngineInput): { result: Omit<SimulationResult, 'id' | 'designCaseId' | 'ranAt'> } {
  const { area, net } = buildNetwork(input)
  const ff = runFreeFloat(input)
  const aux = runAuxDemand(input)
  const n = ff.series.length
  const m = ff.aggregates
  const metrics: SimulationResult['metrics'] = {
    avgTempInC: n ? avg(m.temps) : 0,
    minTempInC: n ? Math.min(...m.temps) : 0,
    maxTempInC: n ? Math.max(...m.temps) : 0,
    avgTempOutC: n ? avg(ff.series.map((p) => p.tempOut)) : 0,
    comfortHours: m.comfortHours,
    totalHours: n,
    comfortPct: n ? (m.comfortHours / n) * 100 : 0,
    solarGainKWh: m.solarKWh,
    conductionKWh: m.condKWh,
    ventilationKWh: m.ventKWh,
    internalGainKWh: m.internalKWh,
    auxDemandKWh: aux.auxKWh,
    meanU: (net.uaOpaque + net.uaOpenings) / Math.max(1, area.wallAreaM2 + area.roofAreaM2 + area.windowAreaM2 + area.doorAreaM2),
    thermalCapacity: net.capacity,
    ach: input.shelter.ach,
    overheatCh: m.overheatCh,
    underheatCh: m.underheatCh,
    avgPpd: m.ppdCount ? m.ppdSum / m.ppdCount : null,
  }
  return {
    result: {
      status: 'complete',
      configSnapshot: {
        shelter: input.shelter,
        settings: input.settings,
        climateProfileId: input.profile.id,
        locationId: input.location.id,
      },
      metrics,
      series: ff.series,
      envelope: {
        wall: net.assemblies.wall,
        roof: net.assemblies.roof,
        floor: net.assemblies.floor,
        insulation: net.assemblies.insulation,
      },
    },
  }
}

/* ------------------------------------------------------------------
   Fanger PMV — simplified screening form for prototype use.
   Stated assumptions: M computed from activity, W=0, radiant temp
   ≈ air temp (small enclosure), v=0.15 m/s, clothing from ensemble.
   ------------------------------------------------------------------ */
export function pmvApprox(tAirC: number, rhPct: number, met: number, clo = 0.9): number {
  const M = met * 58.2 // W/m² body surface
  const W = 0
  const pa = (rhPct / 100) * 0.6105 * Math.exp((17.27 * tAirC) / (tAirC + 237.3)) // vapour pressure kPa
  const tCl = 35.7 - 0.028 * M
  const fcl = 1.0 + 0.2 * clo
  const vAir = 0.15
  const hc = 3.0 + 4.0 * Math.max(0, vAir - 0.1) // approximate convective coeff
  const opTemp = tAirC // radiant ≈ air in small enclosure (assumption)
  const qSkin = M - W
  const eSk = 3.05 * (5.73 - 0.0075 * qSkin) + 0.42 * (qSkin - 50)
  const qRad = 3.96e-8 * fcl * (Math.pow(tCl + 273.15, 4) - Math.pow(opTemp + 273.15, 4))
  const qConv = fcl * hc * (tCl - opTemp)
  const pmvRaw = (0.303 * Math.exp(-0.036 * M) + 0.028) *
    (qSkin - eSk - qRad - qConv - 0.0173 * Math.max(0, M - 58.2) * Math.max(0, pa - 0.5))
  return clamp(-3, 3, pmvRaw)
}

export function pmvToPpd(pmv: number): number {
  return 100 - 95 * Math.exp(-0.03353 * Math.pow(pmv, 4) - 0.2179 * Math.pow(pmv, 2))
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
}
function r1(x: number): number { return Math.round(x * 10) / 10 }
function r2(x: number): number { return Math.round(x * 100) / 100 }
function clamp(lo: number, hi: number, x: number): number {
  return Math.min(hi, Math.max(lo, x))
}
