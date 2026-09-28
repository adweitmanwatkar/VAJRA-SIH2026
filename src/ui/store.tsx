import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CandidateDesign, DesignCase, Material, SimulationResult } from '../domain/types'
import {
  listCases, saveCase, deleteCase as storeDeleteCase,
  listCandidates, candidatesFor, saveCandidate, deleteCandidate,
  listCustomMaterials, saveCustomMaterial, deleteCustomMaterial,
  getResult, saveResult,
  getSettings, saveSettings, type AppSettings,
} from '../services/store'
import { createDemoCases, DEMO_CASE_NAMES } from '../services/demo'
import { REFERENCE_MATERIALS } from '../data/materials'

/* ------------------------------------------------------------------
   Global app store (React context) — single source of truth for the
   prototype session, backed by localStorage persistence.
   ------------------------------------------------------------------ */

export interface StoreShape {
  cases: DesignCase[]
  customMaterials: Material[]
  allMaterials: Material[]
  settings: AppSettings
  candidates: CandidateDesign[]
  createCase: (c: DesignCase) => void
  updateCase: (c: DesignCase) => void
  removeCase: (id: string) => void
  getCase: (id: string) => DesignCase | undefined
  addMaterial: (m: Material) => void
  removeMaterial: (id: string) => void
  updateSettings: (s: Partial<AppSettings>) => void
  candidatesForCase: (caseId: string) => CandidateDesign[]
  addCandidate: (c: CandidateDesign) => void
  updateCandidate: (c: CandidateDesign) => void
  removeCandidate: (id: string) => void
  persistResult: (caseId: string, r: SimulationResult) => void
  resultFor: (caseId: string) => SimulationResult | undefined
  seedDemoData: () => void
  demoSeeded: boolean
}

const Ctx = createContext<StoreShape | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<DesignCase[]>(() => listCases())
  const [customMaterials, setCustomMaterials] = useState<Material[]>(() => listCustomMaterials())
  const [settings, setSettings] = useState<AppSettings>(() => getSettings())
  const [candidates, setCandidates] = useState<CandidateDesign[]>(() => listCandidates())
  const [demoSeeded, setDemoSeeded] = useState(() => listCases().length > 0)

  // First-run: seed demo design cases + pre-cache representative climate profiles
  useEffect(() => {
    if (listCases().length === 0) {
      const demos = createDemoCases()
      demos.forEach(saveCase)
      setCases(demos)
    }
    try {
      // ensure offline readiness: every station's representative profile cached
      import('../services/offline').then((m) => m.cacheAllRepresentativeProfiles())
    } catch {
      // ignore — profiles generate lazily on demand
    }
    setDemoSeeded(true)
  }, [])

  const createCase = useCallback((c: DesignCase) => {
    saveCase(c)
    setCases((prev) => [...prev, c])
  }, [])

  const updateCase = useCallback((c: DesignCase) => {
    const stamped = { ...c, updatedAt: Date.now() }
    saveCase(stamped)
    setCases((prev) => prev.map((x) => (x.id === c.id ? stamped : x)))
  }, [])

  const removeCase = useCallback((id: string) => {
    storeDeleteCase(id)
    setCases((prev) => prev.filter((c) => c.id !== id))
    setCandidates((prev) => prev.filter((c) => c.designCaseId !== id))
  }, [])

  const addMaterial = useCallback((m: Material) => {
    saveCustomMaterial(m)
    setCustomMaterials((prev) => [...prev, m])
  }, [])

  const removeMaterial = useCallback((id: string) => {
    deleteCustomMaterial(id)
    setCustomMaterials((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const updateSettings = useCallback((s: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s }
      saveSettings(next)
      return next
    })
  }, [])

  const candidatesForCase = useCallback((caseId: string) => candidatesFor(caseId), [])

  const addCandidate = useCallback((c: CandidateDesign) => {
    saveCandidate(c)
    setCandidates((prev) => [...prev, c])
  }, [])

  const updateCandidate = useCallback((c: CandidateDesign) => {
    saveCandidate(c)
    setCandidates((prev) => prev.map((x) => (x.id === c.id ? c : x)))
  }, [])

  const removeCandidate = useCallback((id: string) => {
    deleteCandidate(id)
    setCandidates((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const persistResult = useCallback((caseId: string, r: SimulationResult) => {
    saveResult(caseId, r)
  }, [])

  const resultFor = useCallback((caseId: string) => getResult(caseId), [])

  const allMaterials = useMemo(() => [...REFERENCE_MATERIALS, ...customMaterials], [customMaterials])

  const value: StoreShape = {
    cases, customMaterials, allMaterials, settings, candidates,
    createCase, updateCase, removeCase,
    getCase: (id) => cases.find((c) => c.id === id),
    addMaterial, removeMaterial, updateSettings,
    candidatesForCase, addCandidate, updateCandidate, removeCandidate,
    persistResult, resultFor,
    seedDemoData: () => {
      if (listCases().length === 0) {
        const demos = createDemoCases()
        demos.forEach(saveCase)
        setCases(demos)
      }
      setDemoSeeded(true)
    },
    demoSeeded,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreShape {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

export { DEMO_CASE_NAMES }
