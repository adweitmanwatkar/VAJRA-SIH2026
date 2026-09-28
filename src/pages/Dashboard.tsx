import type { DesignCase } from '../domain/types'
import { Button, Card, CardHead, Badge, SectionTitle, StatTile } from '../ui/kit'
import { ShelterVisual } from '../ui/ShelterVisual'
import { LogoMark } from '../ui/brand'
import { countCompletedSimulations, listCandidates } from '../services/store'
import { listCachedProfiles } from '../climate/service'
import { findLocation } from '../data/locations'

/* ------------------------------------------------------------------
   Landing / dashboard — hero + programme status + recent design cases.
   ------------------------------------------------------------------ */

const WORKFLOW = ['Climate', 'Thermal Model', 'Shelter Response', 'Comfort', 'Comparison', 'Recommendation']

export default function Dashboard({ cases, onOpenCase, onCreateCase, onExploreDemo }: {
  cases: DesignCase[]
  onOpenCase: (id: string) => void
  onCreateCase: () => void
  onExploreDemo: () => void
}) {
  const sims = countCompletedSimulations()
  const configs = listCandidates().length
  const profiles = listCachedProfiles().length

  return (
    <div className="animate-fadeUp">
      {/* hero */}
      <div className="relative overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card">
        <div className="absolute inset-0 blueprint-grid opacity-60" />
        <div className="relative grid lg:grid-cols-[1.15fr_0.85fr] gap-6 p-8 lg:p-10">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <LogoMark size={56} className="drop-shadow-[0_4px_14px_rgba(56,189,248,0.35)]" />
              <div>
                <div className="text-[21px] font-extrabold tracking-[0.24em] text-ink-900 leading-none">VAJRA</div>
                <div className="text-[9px] font-semibold tracking-[0.18em] text-ink-400 uppercase mt-1">Climate Smart Shelter Design</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Badge tone="teal">SIH 2026 · PS SIH26051 · DRDO</Badge>
              <Badge tone="neutral">Prototype</Badge>
            </div>
            <h1 className="text-4xl lg:text-[42px] font-extrabold tracking-tight text-ink-900 leading-[1.1]">
              Climate-Adaptive<br />Shelter Design
            </h1>
            <p className="mt-4 text-[15px] text-ink-500 max-w-xl leading-relaxed">
              Simulate, compare and optimize shelter configurations for area-specific thermal comfort —
              before a single panel is fabricated.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={onCreateCase}>Create Design Case →</Button>
              <Button size="lg" variant="outline" onClick={onExploreDemo}>Explore Demo Case</Button>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
              <MiniStat label="Model" value="Transient RC" />
              <MiniStat label="Resolution" value="Hourly" />
              <MiniStat label="Climate source" value="NASA POWER" />
            </div>
          </div>
          <div className="relative">
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-2">
                Reference Shelter · Section
              </div>
              <ShelterVisual shelter={demoVisualShelter()} live={{ tempIn: 19.4, tempOut: -6.5, solar: true }} />
              <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
                <span>Solar gain ↓ · heat retention mode</span>
                <span className="font-mono">Tin 19.4 °C · Tout −6.5 °C</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatTile label="Active Design Cases" value={String(cases.length)} hint="Leh · Jaisalmer · Srinagar + own" />
        <StatTile label="Climate Profiles" value={String(profiles)} unit="cached" tone="teal" hint="Offline-ready time series" />
        <StatTile label="Simulations Completed" value={String(sims)} hint="Deterministic re-runs" />
        <StatTile label="Saved Configurations" value={String(configs)} hint="Candidate + optimized designs" />
      </div>

      {/* workflow strip */}
      <SectionTitle>Analysis Pipeline</SectionTitle>
      <Card>
        <div className="px-5 py-4 flex flex-wrap items-center gap-2">
          {WORKFLOW.map((w, i) => (
            <div key={w} className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${i === 0 ? 'bg-teal-soft text-teal-accent' : 'bg-ink-50 text-ink-500 border border-ink-100'}`}>
                {w}
              </span>
              {i < WORKFLOW.length - 1 && <span className="text-ink-300 text-xs">→</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* recent cases */}
      <SectionTitle right={<Button variant="ghost" size="sm" onClick={onCreateCase}>+ New</Button>}>
        Recent Design Cases
      </SectionTitle>
      <div className="grid md:grid-cols-3 gap-4">
        {cases.slice(0, 6).map((c) => {
          const loc = findLocation(c.locationId)
          return (
            <Card key={c.id} className="hover:border-teal-accent/40 transition-colors cursor-pointer" >
              <button className="text-left w-full" onClick={() => onOpenCase(c.id)}>
                <CardHead
                  title={c.name}
                  sub={`${loc?.name ?? c.locationId}, ${loc?.region ?? ''} · ${loc?.climateZone ?? ''}`}
                />
                <div className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="teal">{loc?.descriptor ?? 'Custom'}</Badge>
                    <Badge>{c.shelter.occupants} occupants</Badge>
                    <Badge>{Math.round(c.shelter.insulationThicknessM * 1000)} mm insulation</Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-ink-400">
                    <span>{new Date(c.updatedAt).toLocaleDateString()} · {c.settings.days}-day window</span>
                    <span className="font-semibold text-teal-accent">Open →</span>
                  </div>
                </div>
              </button>
            </Card>
          )
        })}
      </div>

      <p className="mt-8 text-[11px] text-ink-400 leading-relaxed max-w-3xl">
        Demonstration scenarios (Leh, Jaisalmer, Srinagar) use representative synthetic climate profiles and
        publicly available reference material properties. This prototype does not represent official DRDO
        deployment data, and it is not a certified engineering solver.
      </p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">{label}</div>
      <div className="text-sm font-bold text-ink-800">{value}</div>
    </div>
  )
}

function demoVisualShelter() {
  // visual-only preset matching the Leh demo
  return {
    lengthM: 6, widthM: 3, heightM: 2.5, shape: 'rectangular' as const, orientation: 'S' as const,
    occupants: 8, activity: 'seated-light' as const, internalLoadW: 200,
    windowCount: 2, windowAreaM2: 1.6, doorAreaM2: 1.8, ach: 0.7,
    wallMaterialId: 'sandbag', roofMaterialId: 'concrete', floorMaterialId: 'concrete',
    insulationMaterialId: 'pur-foam', insulationThicknessM: 0.06, extraThermalMassJk: 2.5e6,
  }
}
