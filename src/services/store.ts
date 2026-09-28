import type { CandidateDesign, DesignCase, Material, OptimizationReport, SimulationResult } from '../domain/types'

/* ------------------------------------------------------------------
   Persistence layer (prototype stand-in for the REST API + SQLite
   backend described in the architecture notes). Same JSON schemas,
   swap for HTTP calls without touching the UI.
   ------------------------------------------------------------------ */

const KEY = {
  cases: 'vajra.cases.v1',
  materials: 'vajra.materials.v1',
  results: 'vajra.results.v1',
  candidates: 'vajra.candidates.v1',
  optimizations: 'vajra.optimizations.v1',
  settings: 'vajra.settings.v1',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // best-effort persistence
  }
}

/* ---------------------------- design cases ------------------------- */

export function listCases(): DesignCase[] {
  return read<DesignCase[]>(KEY.cases, [])
}

export function saveCase(c: DesignCase) {
  const all = listCases()
  const i = all.findIndex((x) => x.id === c.id)
  if (i >= 0) all[i] = c
  else all.push(c)
  write(KEY.cases, all)
}

export function deleteCase(id: string) {
  write(KEY.cases, listCases().filter((c) => c.id !== id))
  write(KEY.candidates, listCandidates().filter((c) => c.designCaseId !== id))
  const results = read<Record<string, SimulationResult>>(KEY.results, {})
  delete results[id]
  write(KEY.results, results)
  write(KEY.optimizations, read<OptimizationReport[]>(KEY.optimizations, []).filter((o) => o.designCaseId !== id))
}

export function getCase(id: string): DesignCase | undefined {
  return listCases().find((c) => c.id === id)
}

/* ----------------------------- results ----------------------------- */

export function getResult(caseId: string): SimulationResult | undefined {
  return read<Record<string, SimulationResult>>(KEY.results, {})[caseId]
}

export function saveResult(caseId: string, r: SimulationResult) {
  const all = read<Record<string, SimulationResult>>(KEY.results, {})
  all[caseId] = r
  write(KEY.results, all)
}

export function countCompletedSimulations(): number {
  return Object.keys(read<Record<string, SimulationResult>>(KEY.results, {})).length
}

/* ---------------------------- candidates --------------------------- */

export function listCandidates(): CandidateDesign[] {
  return read<CandidateDesign[]>(KEY.candidates, [])
}

export function candidatesFor(caseId: string): CandidateDesign[] {
  return listCandidates().filter((c) => c.designCaseId === caseId)
}

export function saveCandidate(c: CandidateDesign) {
  const all = listCandidates()
  const i = all.findIndex((x) => x.id === c.id)
  if (i >= 0) all[i] = c
  else all.push(c)
  write(KEY.candidates, all)
}

export function deleteCandidate(id: string) {
  write(KEY.candidates, listCandidates().filter((c) => c.id !== id))
}

/* ---------------------------- materials ---------------------------- */

export function listCustomMaterials(): Material[] {
  return read<Material[]>(KEY.materials, [])
}

export function saveCustomMaterial(m: Material) {
  const all = listCustomMaterials()
  const i = all.findIndex((x) => x.id === m.id)
  if (i >= 0) all[i] = m
  else all.push(m)
  write(KEY.materials, all)
}

export function deleteCustomMaterial(id: string) {
  write(KEY.materials, listCustomMaterials().filter((m) => m.id !== id))
}

/* -------------------------- optimizations -------------------------- */

export function saveOptimization(r: OptimizationReport) {
  const all = read<OptimizationReport[]>(KEY.optimizations, [])
  const i = all.findIndex((x) => x.designCaseId === r.designCaseId)
  if (i >= 0) all[i] = r
  else all.push(r)
  write(KEY.optimizations, all)
}

export function getOptimization(caseId: string): OptimizationReport | undefined {
  return read<OptimizationReport[]>(KEY.optimizations, []).find((o) => o.designCaseId === caseId)
}

/* ----------------------------- settings ---------------------------- */

export interface AppSettings {
  projectName: string
  offlineMode: boolean
}

export function getSettings(): AppSettings {
  return read<AppSettings>(KEY.settings, { projectName: 'Border Shelter Programme — Prototype', offlineMode: false })
}

export function saveSettings(s: AppSettings) {
  write(KEY.settings, s)
}

/* ---------------------------- reset all ---------------------------- */

export function resetAll() {
  Object.values(KEY).forEach((k) => {
    try { localStorage.removeItem(k) } catch { /* noop */ }
  })
  try { localStorage.removeItem('vajra.climateCache.v1') } catch { /* noop */ }
}
