import { useState } from 'react'
import type { DesignCase } from '../domain/types'
import { Button, Card, CardHead, Badge, Callout, Select, EmptyState } from '../ui/kit'
import { ShelterVisual } from '../ui/ShelterVisual'
import { checkCaseValid, STAGES, resolveProfile, runSimulationWithProgress } from '../engine/simulateService'
import { useStore } from '../ui/store'
import { summarize } from '../climate/service'
import { findLocation } from '../data/locations'

/* ------------------------------------------------------------------
   Simulation screen — pre-run summary, staged progress animation,
   completion. Uses the real deterministic engine; progress stages
   mirror the actual pipeline stages.
   ------------------------------------------------------------------ */

export default function SimulationPage({ caseData, cases, onRun, onGoResults, onSelectCase }: {
  caseData: DesignCase | undefined
  cases: DesignCase[]
  onRun: (caseId: string) => Promise<void>
  onGoResults: () => void
  onSelectCase: (id: string) => void
}) {
  const { allMaterials } = useStore()
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<string>('')
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!caseData) {
    return (
      <Card>
        <EmptyState
          title="No design case selected"
          sub="Create or open a design case first — the simulation needs a configured shelter and a climate profile."
        />
      </Card>
    )
  }

  const errors = checkCaseValid(caseData)
  const loc = findLocation(caseData.locationId)
  const profile = (() => {
    try { return resolveProfile(caseData) } catch { return null }
  })()
  const summary = profile ? summarize(profile.points.slice(0, caseData.settings.days * 24)) : null

  const run = async () => {
    setError(null)
    setDone(false)
    setRunning(true)
    try {
      await onRun(caseData.id)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed unexpectedly.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="animate-fadeUp">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Thermal Simulation</h1>
          <p className="text-sm text-ink-400 mt-1">
            Hourly transient analysis · deterministic reduced-order model
          </p>
        </div>
        <div className="w-72">
          <Select
            value={caseData.id}
            onChange={onSelectCase}
            options={cases.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      </div>

      {errors.length > 0 && (
        <Callout tone="warn">
          <b>Fix before running:</b>
          <ul className="list-disc ml-4 mt-1">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </Callout>
      )}

      {/* pre-run summary */}
      <div className="grid lg:grid-cols-4 gap-4 mt-4">
        <SummaryCard title="CASE" lines={[caseData.name, `${caseData.shelter.occupants} occupants · ${caseData.shelter.activity}`]} />
        <SummaryCard title="CLIMATE" lines={[
          loc ? `${loc.name}, ${loc.region}` : caseData.locationId,
          profile ? `${profile.source}` : 'unavailable',
          summary ? `${summary.hours} h · mean ${summary.avgTempC.toFixed(1)} °C` : '',
        ].filter(Boolean)} />
        <SummaryCard title="SHELTER" lines={[
          `${caseData.shelter.lengthM}×${caseData.shelter.widthM}×${caseData.shelter.heightM} m`,
          `${Math.round(caseData.shelter.insulationThicknessM * 1000)} mm insulation · ${caseData.shelter.orientation}-facing`,
        ]} />
        <SummaryCard title="SIMULATION" lines={[
          `Hourly transient analysis`,
          `${caseData.settings.days}-day window · ${caseData.settings.timestepMin}-min steps`,
        ]} />
        <div className="lg:col-span-4">
          <Card>
            <div className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <Kv k="Comfort band" v={`${caseData.settings.comfort.minC}–${caseData.settings.comfort.maxC} °C`} />
                <Kv k="Ventilation" v={`${caseData.shelter.ach.toFixed(1)} ACH`} />
                <Kv k="Glazing" v={`${caseData.shelter.windowAreaM2.toFixed(1)} m²`} />
                <Kv k="Status" v={done ? 'Complete' : running ? 'Running…' : 'Ready'} />
              </div>
              <Button size="lg" onClick={run} disabled={running || errors.length > 0}>
                {running ? 'Solving…' : '▶ Run Thermal Simulation'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* visual + progress */}
      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4 mt-5">
        <Card>
          <CardHead title="Shelter schematic" sub="Configuration under test" />
          <div className="p-4">
            <ShelterVisual shelter={caseData.shelter} />
          </div>
        </Card>
        <Card>
          <CardHead
            title="Simulation progress"
            sub="Stages mirror the actual engine pipeline"
            right={done ? <Badge tone="teal">Simulation Complete</Badge> : undefined}
          />
          <div className="p-5">
            {running && (
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-ink-700">{stage}</span>
                  <span className="font-mono text-ink-400">{pct}%</span>
                </div>
                <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-accent rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
            <ol className="space-y-2">
              {STAGES.map((s, i) => {
                const stageIndex = STAGES.indexOf(stage)
                const isDone = done || (running && i < stageIndex)
                const isCurrent = running && i === stageIndex
                return (
                  <li key={s} className={`flex items-center gap-3 text-[13px] ${isCurrent ? 'text-ink-900 font-semibold' : isDone ? 'text-ink-600' : 'text-ink-300'}`}>
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                      isDone ? 'bg-teal-accent border-teal-accent text-white' :
                      isCurrent ? 'border-teal-accent text-teal-accent animate-pulseDot' : 'border-ink-200 text-ink-300'
                    }`}>
                      {isDone ? '✓' : i + 1}
                    </span>
                    {s}
                  </li>
                )
              })}
            </ol>
            {done && (
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={onGoResults}>View Results →</Button>
                <span className="text-xs text-ink-400">Deterministic: identical inputs → identical outputs.</span>
              </div>
            )}
            {error && (
              <Callout tone="warn">
                <b>Simulation failed.</b> {error}
              </Callout>
            )}
          </div>
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-ink-400 leading-relaxed max-w-3xl">
        Engine: single-zone transient RC heat balance (explicit Euler, {caseData.settings.timestepMin}-min steps) with solar
        gains, envelope conduction, ventilation, internal gains and thermal mass. This browser engine is the prototype
        screening tool — high-fidelity validation (e.g. ANSYS) is a separate future path, not part of this run.
      </p>
    </div>
  )
}

function SummaryCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <Card>
      <div className="px-5 py-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{title}</div>
        {lines.map((l, i) => (
          <div key={i} className={i === 0 ? 'text-sm font-semibold text-ink-800 mt-1' : 'text-xs text-ink-400 mt-0.5'}>{l}</div>
        ))}
      </div>
    </Card>
  )
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-ink-50 pb-1">
      <span className="text-ink-400">{k}</span>
      <span className="font-semibold text-ink-700 tabular-nums">{v}</span>
    </div>
  )
}
