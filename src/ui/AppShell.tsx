import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from './store'
import { Badge } from './kit'
import { VajraLogo } from './brand'
import { resolveProfile } from '../engine/simulateService'

/* ------------------------------------------------------------------
   Application shell — sidebar + top bar. Always shows where the user
   is in the workflow and the climate/simulation status.
   ------------------------------------------------------------------ */

export type Route =
  | 'dashboard' | 'cases' | 'case-editor' | 'case-editor-new' | 'climate' | 'materials' | 'simulation'
  | 'results' | 'comparison' | 'reports' | 'settings'

export const ROUTES: { id: Route; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'cases', label: 'Design Cases', icon: '⬚' },
  { id: 'climate', label: 'Climate', icon: '◠' },
  { id: 'materials', label: 'Materials', icon: '▦' },
  { id: 'simulation', label: 'Simulation', icon: '▶' },
  { id: 'results', label: 'Results', icon: '◈' },
  { id: 'comparison', label: 'Comparison', icon: '⇄' },
  { id: 'reports', label: 'Reports', icon: '▤' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export interface NavState {
  route: Route
  activeCaseId: string | null
}

export function AppShell({ nav, onNav, children }: {
  nav: NavState
  onNav: (r: Route) => void
  children: ReactNode
}) {
  const { cases, getCase, settings } = useStore()
  const activeCase = nav.activeCaseId ? getCase(nav.activeCaseId) : undefined
  const locName = activeCase ? locationName(activeCase.locationId) : null

  const climateStatus = useClimateStatus(activeCase)

  return (
    <div className="flex h-full">
      {/* sidebar */}
      <aside className="w-56 shrink-0 bg-ink-900 text-white flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <Logo />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {ROUTES.map((r) => (
            <button
              key={r.id}
              onClick={() => onNav(r.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                nav.route === r.id ? 'bg-white/10 text-white' : 'text-ink-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="w-4 text-center opacity-70">{r.icon}</span>
              {r.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-ink-400 leading-relaxed">
          <p className="text-ink-300 font-semibold">SIH 2026 · PS SIH26051</p>
          <p>Prototype · reference data only</p>
          <p>Not a certified DRDO solver</p>
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-teal-accent/20 border border-teal-accent/40 flex items-center justify-center text-[10px] font-bold text-teal-accent">ENG</span>
            <div className="leading-tight">
              <div className="text-[11px] font-semibold text-ink-200">Design Engineer</div>
              <div className="text-[10px] text-ink-400">Local session</div>
            </div>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* top bar */}
        <header className="h-14 shrink-0 bg-white border-b border-ink-200 flex items-center gap-4 px-6">
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-ink-800 truncate">{settings.projectName}</div>
            <div className="text-[11px] text-ink-400 truncate">
              {activeCase ? `${activeCase.name} · ${locName ?? ''}` : 'No design case selected'}
            </div>
          </div>
          <div className="flex-1" />
          <StatusPills caseId={nav.activeCaseId} climateStatus={climateStatus} />
          <div className="flex items-center gap-2 pl-4 border-l border-ink-100">
            <button onClick={() => onNav('settings')} className="w-8 h-8 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-600 text-xs font-bold" title="Settings">⚙</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-ink-50">
          <div className="max-w-[1400px] mx-auto px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

function Logo() {
  return <VajraLogo />
}

function StatusPills({ caseId, climateStatus }: { caseId: string | null; climateStatus: string }) {
  const { resultFor } = useStore()
  const result = caseId ? resultFor(caseId) : undefined
  return (
    <div className="flex items-center gap-2">
      <Badge tone={climateStatus === 'cached' ? 'teal' : 'blue'}>
        <span className={`w-1.5 h-1.5 rounded-full ${climateStatus === 'cached' ? 'bg-teal-accent animate-pulseDot' : 'bg-blue-500'}`} />
        Climate {climateStatus}
      </Badge>
      <Badge tone={result ? 'teal' : 'neutral'}>
        <span className={`w-1.5 h-1.5 rounded-full ${result ? 'bg-teal-accent' : 'bg-ink-300'}`} />
        Simulation {result ? 'complete' : 'pending'}
      </Badge>
    </div>
  )
}

function useClimateStatus(activeCase: DesignCaseT | undefined): string {
  const [status, setStatus] = useState('pending')
  useEffect(() => {
    try {
      if (!activeCase) { setStatus('pending'); return }
      const p = resolveProfile(activeCase) // also ensures the profile is cached
      setStatus(p.kind === 'representative' ? 'cached' : p.kind === 'live' ? 'live · cached' : 'user · cached')
    } catch {
      setStatus('unavailable')
    }
  }, [activeCase?.id])
  return status
}

function locationName(id: string): string | null {
  const map: Record<string, string> = {
    leh: 'Leh, Ladakh', jaisalmer: 'Jaisalmer, Rajasthan', srinagar: 'Srinagar, J&K',
    tawang: 'Tawang, Arunachal', jodhpur: 'Jodhpur, Rajasthan', 'port-blair': 'Port Blair',
  }
  return map[id] ?? id
}

type DesignCaseT = import('../domain/types').DesignCase
