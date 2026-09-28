import { useCallback, useState } from 'react'
import { StoreProvider, useStore } from './ui/store'
import { AppShell, type Route } from './ui/AppShell'
import Dashboard from './pages/Dashboard'
import DesignCases from './pages/DesignCases'
import CaseEditor from './pages/CaseEditor'
import Climate from './pages/Climate'
import Materials from './pages/Materials'
import SimulationPage from './pages/SimulationPage'
import Results from './pages/Results'
import Comparison from './pages/Comparison'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import { findLocation } from './data/locations'
import { getCase, saveResult } from './services/store'
import { runSimulationWithProgress } from './engine/simulateService'

function Router() {
  const store = useStore()
  const [route, setRoute] = useState<Route>('dashboard')
  const [activeCaseId, setActiveCaseId] = useState<string | null>(() => store.cases[0]?.id ?? null)

  const selectCase = useCallback((id: string | null) => setActiveCaseId(id), [])

  const runSim = useCallback(
    async (caseId: string): Promise<void> => {
      const c = getCase(caseId)
      if (!c) throw new Error('Design case not found.')
      const loc = findLocation(c.locationId)
      if (!loc) throw new Error('Unknown location for the design case.')
      const result = await runSimulationWithProgress(c, store.allMaterials, loc, () => {})
      saveResult(caseId, result)
    },
    [store.allMaterials],
  )

  const go = (r: Route) => setRoute(r)

  return (
    <AppShell nav={{ route, activeCaseId }} onNav={go}>
      {route === 'dashboard' && (
        <Dashboard
          cases={store.cases}
          onOpenCase={(id) => { selectCase(id); go('simulation') }}
          onCreateCase={() => go('cases')}
          onExploreDemo={() => { const demo = store.cases[0]; if (demo) { selectCase(demo.id); go('simulation') } }}
        />
      )}
      {route === 'cases' && (
        <DesignCases
          cases={store.cases}
          onSelect={(id) => { selectCase(id); go('case-editor') }}
          onCreate={() => go('case-editor-new')}
        />
      )}
      {route === 'case-editor' && activeCaseId && (
        <CaseEditor caseId={activeCaseId} onDone={() => go('simulation')} onCases={() => go('cases')} />
      )}
      {route === 'case-editor-new' && (
        <CaseEditor caseId={null} onDone={() => go('simulation')} onCases={() => go('cases')} onCreated={selectCase} />
      )}
      {route === 'climate' && <Climate activeCase={activeCaseId ? getCase(activeCaseId) : undefined} />}
      {route === 'materials' && <Materials />}
      {route === 'simulation' && (
        <SimulationPage
          caseData={activeCaseId ? getCase(activeCaseId) : undefined}
          onRun={runSim}
          onGoResults={() => go('results')}
          onSelectCase={selectCase}
          cases={store.cases}
        />
      )}
      {route === 'results' && (
        <Results
          caseData={activeCaseId ? getCase(activeCaseId) : undefined}
          onGoCompare={() => go('comparison')}
          onGoSim={() => go('simulation')}
        />
      )}
      {route === 'comparison' && <Comparison activeCaseId={activeCaseId} />}
      {route === 'reports' && <Reports activeCaseId={activeCaseId} />}
      {route === 'settings' && <Settings />}
    </AppShell>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  )
}
