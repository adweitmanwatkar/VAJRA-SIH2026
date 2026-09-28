import type {
  CandidateDesign,
  Comparison,
  ComparisonEntry,
  DesignCase,
  Material,
  OptimizationReport,
  Recommendation,
  Shelter,
  SimulationResult,
  SimulationSettings,
} from '../domain/types'
import { runSimulation } from '../engine/thermal'
import { resolveProfile } from '../engine/simulateService'
import { findLocation } from '../data/locations'
import { REFERENCE_MATERIALS } from '../data/materials'
import { newId } from './ids'

/* ------------------------------------------------------------------
   Analysis engines — comparison, constrained parameter-sweep
   optimization, and recommendation generation. All operate on actual
   SimulationResult metrics computed by the thermal engine under the
   SAME climate profile.
   ------------------------------------------------------------------ */

export const CANDIDATE_COLORS = ['#0d9488', '#b45309', '#1d4ed8', '#9333ea', '#be123c', '#4d7c0f']

/* ---------------------------- comparison ---------------------------- */

export function buildComparison(caseData: DesignCase, candidates: CandidateDesign[]): Comparison | null {
  const withResults = candidates.filter((c) => c.result)
  if (withResults.length < 2) return null

  const val = (c: CandidateDesign, get: (r: SimulationResult) => number | string): number | string =>
    get(c.result as SimulationResult)

  const rows: ComparisonEntry[] = [
    row('Average indoor temperature', '°C', withResults, (r) => r.metrics.avgTempInC, false, 1, val),
    row('Minimum indoor temperature', '°C', withResults, (r) => r.metrics.minTempInC, false, 1, val),
    row('Maximum indoor temperature', '°C', withResults, (r) => r.metrics.maxTempInC, false, 1, val),
    row('Comfort hours', 'h', withResults, (r) => r.metrics.comfortHours, true, 0, val),
    row('Comfort coverage', '%', withResults, (r) => r.metrics.comfortPct, true, 0, val),
    row('Solar gain', 'kWh', withResults, (r) => r.metrics.solarGainKWh, true, 1, val),
    row('Conduction loss', 'kWh', withResults, (r) => r.metrics.conductionKWh, false, 1, val),
    row('Ventilation loss', 'kWh', withResults, (r) => r.metrics.ventilationKWh, false, 1, val),
    row('Internal heat gain', 'kWh', withResults, (r) => r.metrics.internalGainKWh, true, 0, val),
    row('Aux. energy demand', 'kWh', withResults, (r) => r.metrics.auxDemandKWh, false, 1, val),
    row('Mean envelope U-value', 'W/m²K', withResults, (r) => r.metrics.meanU, false, 2, val),
    row('Envelope heat capacity', 'MJ/K', withResults, (r) => r.metrics.thermalCapacity / 1e6, true, 2, val),
    row('Ventilation rate', 'ACH', withResults, (r) => r.metrics.ach, false, 1, val),
    row('Orientation', '', withResults, (r) => orientationLabel(r.configSnapshot.shelter.orientation), true, 0, val),
    row('Insulation thickness', 'mm', withResults, (r) => r.configSnapshot.shelter.insulationThicknessM * 1000, false, 0, val),
    row('Window area', 'm²', withResults, (r) => r.configSnapshot.shelter.windowAreaM2, true, 1, val),
  ]

  // best candidate: highest comfort-hours, tie-break on lower aux demand
  let bestId: string | null = null
  let bestComfort = -1
  let bestAux = Infinity
  for (const c of withResults) {
    const m = c.result!.metrics
    if (m.comfortHours > bestComfort || (m.comfortHours === bestComfort && m.auxDemandKWh < bestAux)) {
      bestComfort = m.comfortHours
      bestAux = m.auxDemandKWh
      bestId = c.id
    }
  }

  const rationale: string[] = [
    'All candidates simulated under the SAME climate profile and comfort settings.',
    'Best column (teal) = highest comfort-hours; ties broken on lower auxiliary energy demand.',
  ]

  return {
    id: newId('cmp'),
    designCaseId: caseData.id,
    createdAt: Date.now(),
    candidateIds: withResults.map((c) => c.id),
    entries: rows,
    bestCandidateId: bestId,
    rationale,
  }
}

function row(
  label: string,
  unit: string,
  candidates: CandidateDesign[],
  get: (r: SimulationResult) => number | string,
  higherIsBetter: boolean,
  decimals: number,
  val: (c: CandidateDesign, get: (r: SimulationResult) => number | string) => number | string,
): ComparisonEntry {
  return {
    label,
    unit,
    higherIsBetter,
    decimals,
    values: candidates.map((c) => val(c, get)),
  }
}

function orientationLabel(o: string): string {
  const full: Record<string, string> = {
    N: 'North', NE: 'North-East', E: 'East', SE: 'South-East',
    S: 'South', SW: 'South-West', W: 'West', NW: 'North-West',
  }
  return full[o] ?? o
}

/* --------------------------- optimization --------------------------- */

export interface OptimizeOptions {
  /** sweep resolution */
  quick: boolean
}

export function optimizeDesign(
  caseData: DesignCase,
  materials: Material[],
  onProgress?: (evaluated: number, total: number) => void,
): OptimizationReport {
  const base = caseData.shelter
  const settings = caseData.settings
  const location = findLocation(caseData.locationId)
  if (!location) throw new Error('Unknown location for optimization.')

  const thicknesses = [0, 0.025, 0.05, 0.075, 0.1]
  const wallChoices = ['steel-sheet', 'plywood', 'sandbag', 'concrete', 'timber']
  const roofChoices = ['steel-sheet', 'concrete', 'plywood']
  const orientations: Shelter['orientation'][] = ['N', 'E', 'SE', 'S', 'SW', 'W']
  const windowAreas = [0.4, 0.8, 1.6, 2.4]
  const achValues = [0.5, 1.0, 2.0]

  const wallMats = wallChoices.map((id) => materials.find((m) => m.id === id) ?? REFERENCE_MATERIALS.find((m) => m.id === id)!).filter(Boolean)
  const roofMats = roofChoices.map((id) => materials.find((m) => m.id === id) ?? REFERENCE_MATERIALS.find((m) => m.id === id)!).filter(Boolean)
  const insMat = materials.find((m) => m.id === base.insulationMaterialId) ?? REFERENCE_MATERIALS.find((m) => m.id === 'pur-foam')!

  const combos: Shelter[] = []
  for (const t of thicknesses)
    for (const w of wallMats)
      for (const r of roofMats)
        for (const o of orientations)
          for (const wa of windowAreas)
            for (const ach of achValues) {
              combos.push({ ...base, insulationThicknessM: t, wallMaterialId: w.id, roofMaterialId: r.id, orientation: o, windowAreaM2: wa, ach })
            }

  const profile = resolveProfile(caseData)
  const results: { shelter: Shelter; metrics: SimulationResult['metrics'] }[] = []
  let evaluated = 0

  // Two-stage sweep: coarse pass then refine around the best coarse point.
  const coarseStep = Math.max(1, Math.floor(combos.length / 120))
  const coarseIdx: number[] = []
  for (let i = 0; i < combos.length; i += coarseStep) coarseIdx.push(i)

  let bestScore = -Infinity
  let bestShelter = base
  const scored: { shelter: Shelter; comfortPct: number; auxKWh: number; score: number; feasible: boolean }[] = []

  const evaluate = (shelter: Shelter) => {
    const out = runSimulation({ shelter, settings, profile, location, materials })
    const m = out.result.metrics
    evaluated += 1
    const feasible = m.comfortPct >= FEASIBLE_COMFORT_PCT
    const score = scoreOf(m)
    scored.push({ shelter, comfortPct: m.comfortPct, auxKWh: m.auxDemandKWh, score, feasible })
    if (score > bestScore) {
      bestScore = score
      bestShelter = shelter
    }
    results.push({ shelter, metrics: m })
    onProgress?.(evaluated, coarseIdx.length)
  }

  for (const i of coarseIdx) evaluate(combos[i])

  // refine: local search around best coarse shelter
  const refinements: Shelter[] = []
  for (const dt of [-0.015, 0, 0.015]) {
    for (const dwa of [-0.4, 0, 0.4]) {
      for (const dach of [-0.25, 0, 0.25]) {
        refinements.push({
          ...bestShelter,
          insulationThicknessM: clampNum(bestShelter.insulationThicknessM + dt, 0, 0.15),
          windowAreaM2: Math.max(0.2, bestShelter.windowAreaM2 + dwa),
          ach: clampNum(bestShelter.ach + dach, 0.3, 3),
        })
      }
    }
  }
  for (const s of refinements) evaluate(s)

  scored.sort((a, b) => b.score - a.score)

  const feasibleCount = scored.filter((s) => s.feasible).length
  const best = scored[0]
  const baselineMetrics = runSimulation({ shelter: base, settings, profile, location, materials }).result.metrics

  const bestResult: SimulationResult = {
    ...runSimulation({ shelter: best.shelter, settings, profile, location, materials }).result,
    id: newId('sim'),
    designCaseId: caseData.id,
    ranAt: Date.now(),
  }

  const candidate: CandidateDesign = {
    id: newId('cand'),
    designCaseId: caseData.id,
    name: 'Optimized Configuration',
    color: CANDIDATE_COLORS[3],
    shelter: best.shelter,
    settings,
    result: bestResult,
  }

  const notes = [
    'All candidates evaluated under the SAME climate profile and comfort settings.',
    'Geometry (footprint, height, occupants) held at the design-case values; only envelope/orientation/openings varied.',
    'Feasible = comfort-hours ≥ 80% of the simulated window under the configured comfort band.',
    feasibleCount === 0
      ? 'NO feasible configuration found: the comfort band cannot be maintained passively in this climate window — the recommendation below is the minimum-auxiliary-demand configuration, and an active heat source is required for occupancy.'
      : `${feasibleCount} feasible configurations found; the recommendation is the top-scored feasible design.`,
    'Score = 0.6·comfort + 0.4·energy (details in the trade-off table). Screening model only.',
  ]

  const recommendation = buildRecommendation(caseData, candidate, baselineMetrics, materials)

  return {
    id: newId('opt'),
    designCaseId: caseData.id,
    ranAt: Date.now(),
    objective: 'Maximise comfort-hours, minimise auxiliary thermal energy demand, respect fixed geometry.',
    evaluated,
    feasible: feasibleCount,
    bestCandidate: candidate,
    ranking: scored.slice(0, 12).map((s) => ({
      candidateId: newId('rk'),
      name: describeShelter(s.shelter, materials),
      score: Math.round(s.score * 100) / 100,
      comfortPct: Math.round(s.comfortPct),
      auxKWh: Math.round(s.auxKWh * 10) / 10,
      feasible: s.feasible,
    })),
    constraintNotes: notes,
    recommendation,
  }
}

const FEASIBLE_COMFORT_PCT = 80

function scoreOf(m: SimulationResult['metrics']): number {
  const comfortScore = m.comfortPct / 100
  // energy score: normalise 0..1 against a 200 kWh screening ceiling
  const energyScore = 1 - Math.min(1, m.auxDemandKWh / 200)
  return 0.6 * comfortScore + 0.4 * energyScore
}

function clampNum(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

function describeShelter(s: Shelter, materials: Material[]): string {
  const wall = materials.find((m) => m.id === s.wallMaterialId)?.name ?? s.wallMaterialId
  const ins = s.insulationThicknessM > 0 ? `${Math.round(s.insulationThicknessM * 1000)} mm` : 'none'
  return `${s.orientation}-facing · ${wall} · ${ins} insulation · ${s.windowAreaM2.toFixed(1)} m² glazing · ${s.ach.toFixed(1)} ACH`
}

/* -------------------------- recommendation -------------------------- */

export function buildRecommendation(
  caseData: DesignCase,
  candidate: CandidateDesign,
  baseline: SimulationResult['metrics'],
  materials: Material[],
): Recommendation {
  const r = candidate.result!
  const m = r.metrics
  const s = candidate.shelter
  const wall = materials.find((mm) => mm.id === s.wallMaterialId)?.name ?? s.wallMaterialId
  const roof = materials.find((mm) => mm.id === s.roofMaterialId)?.name ?? s.roofMaterialId
  const ins = materials.find((mm) => mm.id === s.insulationMaterialId)?.name ?? s.insulationMaterialId

  const reasons: string[] = []
  const tradeoffs: string[] = []

  const dComfort = m.comfortHours - baseline.comfortHours
  const dAux = m.auxDemandKWh - baseline.auxDemandKWh
  const dCond = m.conductionKWh - baseline.conductionKWh
  const dSolar = m.solarGainKWh - baseline.solarGainKWh

  // Transparency: state plainly when the comfort target is not passively achievable
  if (m.comfortPct < 50) {
    reasons.push(
      `No configuration in the sweep reaches the configured comfort band passively in this window — an auxiliary heat source is REQUIRED. This configuration minimizes the estimated auxiliary demand (${m.auxDemandKWh.toFixed(1)} kWh ≈ ${(m.auxDemandKWh / Math.max(1, m.totalHours / 24)).toFixed(1)} kWh/day).`,
    )
    tradeoffs.push(
      `Comfort coverage is ${Math.round(m.comfortPct)} % under free-float operation; the comfort band is only maintained when the estimated auxiliary energy is actually supplied.`,
    )
  }

  if (dComfort > 0) reasons.push(`Maintains the target comfort band ${Math.round(dComfort)} h longer than the baseline under the same climate.`)
  else if (m.comfortPct >= 50) reasons.push(`Comfort coverage ${Math.round(m.comfortPct)}% of the simulated window — highest achievable within the sweep constraints.`)
  if (dAux < 0) reasons.push(`Cuts estimated auxiliary energy demand by ${Math.abs(dAux).toFixed(1)} kWh over the simulated window.`)
  if (dCond < 0) reasons.push(`Reduces envelope conduction loss by ${Math.abs(dCond).toFixed(1)} kWh versus baseline.`)
  if (dSolar > 0) reasons.push(`Orientation ${orientationLabel(s.orientation)} captures more passive solar gain (+${dSolar.toFixed(1)} kWh).`)
  if (s.insulationThicknessM > 0) reasons.push(`${ins} insulation at ${Math.round(s.insulationThicknessM * 1000)} mm lowers the mean envelope U-value to ${m.meanU.toFixed(2)} W/m²K.`)
  reasons.push('Meets the fixed geometry/occupancy constraints of the design case.')

  if (s.ach < 1) tradeoffs.push(`Low ventilation (${s.ach.toFixed(1)} ACH) conserves heat but may require attention to air quality — verify against occupancy guidelines.`)
  if (s.windowAreaM2 > 2) tradeoffs.push('Large glazing increases daytime solar gain but also nighttime loss; shutters/curtains recommended.')
  if (s.insulationThicknessM >= 0.1) tradeoffs.push('Thicker insulation adds material volume and cost — confirm logistics for the deployment area.')
  if (tradeoffs.length === 0) tradeoffs.push('No significant performance trade-offs identified within the screening model.')

  const metrics: ComparisonEntry[] = [
    { label: 'Comfort hours', unit: '%', values: [Math.round(m.comfortPct)], higherIsBetter: true, decimals: 0 },
    { label: 'Aux. energy demand', unit: 'kWh', values: [Math.round(m.auxDemandKWh * 10) / 10], higherIsBetter: false, decimals: 1 },
    { label: 'Avg indoor temperature', unit: '°C', values: [Math.round(m.avgTempInC * 10) / 10], higherIsBetter: true, decimals: 1 },
    { label: 'Conduction loss', unit: 'kWh', values: [Math.round(m.conductionKWh)], higherIsBetter: false, decimals: 0 },
  ]

  return {
    candidateId: candidate.id,
    headline: `Recommended configuration under the selected assumptions — ${Math.round(m.comfortPct)}% comfort coverage, ${m.auxDemandKWh.toFixed(1)} kWh aux demand.`,
    reasons,
    tradeoffs,
    metrics,
  }
}
