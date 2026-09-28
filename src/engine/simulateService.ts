import type { DesignCase, LocationInfo, Material, SimulationResult } from '../domain/types'
import { runSimulation } from '../engine/thermal'
import { findLocation } from '../data/locations'
import { getRepresentativeProfile, getCachedProfile } from '../climate/service'

/* ------------------------------------------------------------------
   Simulation orchestration service.

   Runs the deterministic thermal engine inside the browser. Progress
   stages are reported via callback and yield to the event loop so the
   UI stays responsive. This is the browser prototype engine — the
   ANSYS high-fidelity solver is a FUTURE validation path, not this.
   ------------------------------------------------------------------ */

export interface StageUpdate {
  stage: string
  detail?: string
  pct: number
}

export type StageFn = (u: StageUpdate) => void

const STAGES = [
  'Loading climate profile',
  'Preparing geometry',
  'Calculating solar gains',
  'Calculating conduction',
  'Calculating ventilation losses',
  'Solving transient heat balance',
  'Evaluating comfort',
  'Generating results',
]

function yieldToUi(): Promise<void> {
  return new Promise((r) => setTimeout(r, 90))
}

export async function runSimulationWithProgress(
  caseData: DesignCase,
  materials: Material[],
  location: LocationInfo,
  onStage: StageFn,
): Promise<SimulationResult> {
  for (let i = 0; i < STAGES.length; i++) {
    onStage({ stage: STAGES[i], pct: Math.round(((i + 0.2) / STAGES.length) * 100) })
    await yieldToUi()
    if (i === 5) {
      // heavy solve — run engine, then report completion
      onStage({ stage: STAGES[5], detail: 'Explicit Euler · reduced-order RC model', pct: Math.round((6 / STAGES.length) * 100) })
      const result = computeResult(caseData, materials, location)
      await yieldToUi()
      for (let j = 6; j < STAGES.length; j++) {
        onStage({ stage: STAGES[j], pct: Math.round(((j + 1) / STAGES.length) * 100) })
        await yieldToUi()
      }
      return result
    }
  }
  throw new Error('unreachable')
}

function computeResult(caseData: DesignCase, materials: Material[], location: LocationInfo): SimulationResult {
  const profile = resolveProfile(caseData)
  const out = runSimulation({
    shelter: caseData.shelter,
    settings: caseData.settings,
    profile,
    location,
    materials,
  })
  return {
    id: `sim_${caseData.id}`,
    designCaseId: caseData.id,
    ranAt: Date.now(),
    status: out.result.status,
    configSnapshot: out.result.configSnapshot,
    metrics: out.result.metrics,
    series: out.result.series,
    envelope: out.result.envelope,
  }
}

export function resolveProfile(caseData: DesignCase): ReturnType<typeof getRepresentativeProfile> {
  const cached = getCachedProfile(caseData.climateProfileId)
  if (cached) return cached
  const loc = findLocation(caseData.locationId)
  if (!loc) throw new Error(`Unknown location '${caseData.locationId}' for case '${caseData.name}'.`)
  return getRepresentativeProfile(loc)
}

export function checkCaseValid(caseData: DesignCase): string[] {
  const errors: string[] = []
  const s = caseData.shelter
  if (!(s.lengthM > 0.5)) errors.push('Shelter length must be > 0.5 m.')
  if (!(s.widthM > 0.5)) errors.push('Shelter width must be > 0.5 m.')
  if (!(s.heightM > 0.5)) errors.push('Shelter height must be > 0.5 m.')
  if (s.occupants < 0) errors.push('Occupants cannot be negative.')
  if (s.windowAreaM2 < 0 || s.doorAreaM2 < 0) errors.push('Openings areas cannot be negative.')
  if (s.insulationThicknessM < 0 || s.insulationThicknessM > 0.5) errors.push('Insulation thickness must be 0–500 mm.')
  if (s.ach < 0.2 || s.ach > 15) errors.push('Ventilation rate must be 0.2–15 ACH.')
  if (!s.wallMaterialId) errors.push('Select a wall material.')
  if (!s.roofMaterialId) errors.push('Select a roof material.')
  if (!s.insulationMaterialId) errors.push('Select an insulation material (or set thickness to 0).')
  if (caseData.settings.days < 1 || caseData.settings.days > 30) errors.push('Simulation window must be 1–30 days.')
  if (caseData.settings.comfort.minC >= caseData.settings.comfort.maxC) errors.push('Comfort band: min must be below max.')
  return errors
}

export { STAGES }
