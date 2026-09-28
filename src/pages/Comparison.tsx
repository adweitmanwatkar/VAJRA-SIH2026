import { useMemo, useState } from 'react'
import type { CandidateDesign, DesignCase, Shelter, SimulationSettings } from '../domain/types'
import { Badge, Button, Card, CardHead, Callout, EmptyState, SectionTitle } from '../ui/kit'
import { ComparisonBar } from '../ui/charts'
import { useStore } from '../ui/store'
import { buildComparison, optimizeDesign, CANDIDATE_COLORS } from '../services/analysis'
import { runSimulation } from '../engine/thermal'
import { resolveProfile } from '../engine/simulateService'
import { findLocation } from '../data/locations'
import { newId } from '../services/ids'
import { getOptimization } from '../services/store'

/* ------------------------------------------------------------------
   Design comparison + optimization + recommendation.
   Every candidate is simulated under the SAME climate profile and
   comfort settings; the comparison table is built from the results.
   ------------------------------------------------------------------ */

export default function Comparison({ activeCaseId }: { activeCaseId: string | null }) {
  const store = useStore()
  const caseData: DesignCase | undefined = activeCaseId ? store.getCase(activeCaseId) : undefined
  const candidates = useMemo(() => (activeCaseId ? store.candidatesForCase(activeCaseId) : []), [activeCaseId, store])
  const [busy, setBusy] = useState<string | null>(null)
  const [optBusy, setOptBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!caseData) {
    return (
      <Card>
        <EmptyState title="No design case selected" sub="Select a design case to compare candidate shelters." />
      </Card>
    )
  }

  const withResults = candidates.filter((c) => c.result)
  const comparison = buildComparison(caseData, candidates)
  const optimization = getOptimization(caseData.id)

  const addCandidate = (name: string, mutate: (s: Shelter) => Shelter) => {
    const c: CandidateDesign = {
      id: newId('cand'),
      designCaseId: caseData.id,
      name,
      color: CANDIDATE_COLORS[candidates.length % CANDIDATE_COLORS.length],
      shelter: mutate(structuredClone(caseData.shelter)),
      settings: structuredClone(caseData.settings),
      result: null,
    }
    store.addCandidate(c)
    setMessage(`Added “${name}”. Run it to include it in the comparison.`)
  }

  const runCandidate = async (c: CandidateDesign) => {
    setBusy(c.id)
    setMessage(null)
    await new Promise((r) => setTimeout(r, 60)) // let the UI paint
    try {
      const loc = findLocation(caseData.locationId)
      if (!loc) throw new Error('Unknown location.')
      const profile = resolveProfile(caseData)
      const out = runSimulation({ shelter: c.shelter, settings: c.settings, profile, location: loc, materials: store.allMaterials })
      store.updateCandidate({
        ...c,
        result: { ...out.result, id: `sim_${c.id}`, designCaseId: caseData.id, ranAt: Date.now() },
      })
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Candidate simulation failed.')
    } finally {
      setBusy(null)
    }
  }

  const runAll = async () => {
    for (const c of candidates) {
      if (!c.result) await runCandidate(c)
    }
  }

  const runOptimization = async () => {
    setOptBusy(true)
    setMessage(null)
    await new Promise((r) => setTimeout(r, 60))
    try {
      const loc = findLocation(caseData.locationId)
      if (!loc) throw new Error('Unknown location.')
      const report = optimizeDesign(caseData, store.allMaterials)
      // persist the optimized candidate so it appears in comparisons
      store.addCandidate(report.bestCandidate)
      // save report
      const { saveOptimization } = await import('../services/store')
      saveOptimization(report)
      setMessage(`Optimization evaluated ${report.evaluated} configurations · ${report.feasible} feasible.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Optimization failed.')
    } finally {
      setOptBusy(false)
    }
  }

  return (
    <div className="animate-fadeUp">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Design Comparison</h1>
          <p className="text-sm text-ink-400 mt-1">
            Candidate shelters for “{caseData.name}” — all evaluated under the same climate profile.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runAll} disabled={candidates.length === 0 || !!busy}>Run All</Button>
        </div>
      </div>

      {message && <Callout tone="teal">{message}</Callout>}

      {/* candidate creation */}
      <SectionTitle>Candidate Designs</SectionTitle>
      <div className="grid md:grid-cols-3 gap-4">
        <QuickAdd
          title="A — Baseline"
          desc="Exactly as configured in the design case."
          onAdd={() => addCandidate('A — Baseline (as configured)', (s) => s)}
          count={candidates.length}
        />
        <QuickAdd
          title="B — Insulated"
          desc="+ insulation to 100 mm PUR, tighter envelope."
          onAdd={() => addCandidate('B — Insulated', (s) => ({ ...s, insulationMaterialId: 'pur-foam', insulationThicknessM: 0.1, ach: Math.max(0.5, s.ach * 0.8) }))}
          count={candidates.length}
        />
        <QuickAdd
          title="C — Passive Optimized"
          desc="High thermal mass, solar-oriented, controlled ventilation."
          onAdd={() => addCandidate('C — Passive Optimized', (s) => ({
            ...s,
            orientation: 'S',
            wallMaterialId: 'concrete',
            roofMaterialId: 'concrete',
            insulationMaterialId: 'pur-foam',
            insulationThicknessM: 0.06,
            extraThermalMassJk: 2e6,
            windowAreaM2: 1.0,
            ach: 0.7,
          }))}
          count={candidates.length}
        />
      </div>

      {/* candidate list */}
      <div className="mt-4 space-y-2">
        {candidates.length === 0 && (
          <Card>
            <EmptyState
              title="No candidates yet"
              sub="Add a baseline, then insulated and passive variants to compare them under identical climate conditions."
            />
          </Card>
        )}
        {candidates.map((c, i) => (
          <Card key={c.id}>
            <div className="px-5 py-3.5 flex flex-wrap items-center gap-4">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink-800">{c.name}</div>
                <div className="text-xs text-ink-400 font-mono truncate">
                  {c.shelter.orientation} · {matName(store, c.shelter.wallMaterialId)} wall ·{' '}
                  {Math.round(c.shelter.insulationThicknessM * 1000)} mm ins · {c.shelter.windowAreaM2.toFixed(1)} m² glazing · {c.shelter.ach.toFixed(1)} ACH
                </div>
              </div>
              {c.result ? (
                <div className="flex items-center gap-4 text-xs">
                  <span className="tabular-nums"><span className="text-ink-400">Comfort</span> <b className="text-ink-800">{Math.round(c.result.metrics.comfortPct)}%</b></span>
                  <span className="tabular-nums"><span className="text-ink-400">T̄in</span> <b className="text-ink-800">{c.result.metrics.avgTempInC.toFixed(1)}°C</b></span>
                  <span className="tabular-nums"><span className="text-ink-400">Aux</span> <b className="text-ink-800">{c.result.metrics.auxDemandKWh.toFixed(1)} kWh</b></span>
                  <Badge tone="teal">Simulated</Badge>
                </div>
              ) : (
                <Badge>Not run</Badge>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => runCandidate(c)} disabled={busy === c.id}>
                  {busy === c.id ? 'Running…' : c.result ? 'Re-run' : 'Run'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => store.removeCandidate(c.id)}>Delete</Button>
              </div>
              <span className="hidden">{i}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* comparison table */}
      {comparison && (
        <>
          <SectionTitle>Comparison Table</SectionTitle>
          <Card>
            <CardHead
              title={`${withResults.length} designs vs identical climate input`}
              sub={comparison.rationale.join(' · ')}
            />
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-ink-400 text-xs uppercase tracking-wide">
                    <th className="py-2 pr-4 font-semibold">Parameter</th>
                    {withResults.map((c) => (
                      <th key={c.id} className="py-2 pr-4 font-semibold" style={{ color: c.color }}>
                        {c.name}
                        {comparison.bestCandidateId === c.id && <span className="ml-1.5 text-[10px] bg-teal-soft text-teal-accent px-1.5 py-0.5 rounded">BEST</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.entries.map((e) => (
                    <tr key={e.label + e.unit} className="border-t border-ink-50">
                      <td className="py-2 pr-4 text-ink-500">
                        {e.label} {e.unit && <span className="text-ink-300">[{e.unit}]</span>}
                      </td>
                      {e.values.map((v, i) => (
                        <td key={i} className="py-2 pr-4 font-semibold tabular-nums text-ink-800">
                          {typeof v === 'number' ? v.toFixed(e.decimals) : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* comparison charts */}
          <div className="grid xl:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHead title="Comfort coverage" sub="% of simulated hours inside the comfort band" />
              <div className="p-4">
                <ComparisonBar
                  data={withResults.map((c) => ({ name: shortName(c.name), value: Math.round(c.result!.metrics.comfortPct) }))}
                  unit="%" label="Comfort"
                />
              </div>
            </Card>
            <Card>
              <CardHead title="Auxiliary energy demand" sub="kWh over the simulated window (lower is better)" />
              <div className="p-4">
                <ComparisonBar
                  data={withResults.map((c) => ({ name: shortName(c.name), value: +c.result!.metrics.auxDemandKWh.toFixed(1) }))}
                  unit="kWh" label="Aux demand"
                />
              </div>
            </Card>
          </div>
        </>
      )}

      {/* optimization */}
      <SectionTitle>Optimize Design</SectionTitle>
      <Card>
        <CardHead
          title="Constrained parameter sweep"
          sub="Insulation thickness × wall/roof material × orientation × glazing × ventilation — screened by the same thermal engine"
          right={
            <Button onClick={runOptimization} disabled={optBusy}>
              {optBusy ? 'Evaluating…' : '▶ Run Optimization'}
            </Button>
          }
        />
        <div className="p-5">
          {optBusy && (
            <div className="text-sm text-ink-500 flex items-center gap-3">
              <span className="w-4 h-4 border-2 border-teal-accent border-t-transparent rounded-full animate-spin" />
              Screening ~150 shelter configurations under the case climate profile…
            </div>
          )}
          {!optBusy && !optimization && (
            <p className="text-sm text-ink-400">
              The sweep coarsely screens the parameter space, then refines around the best point. Objective: maximise
              comfort-hours, minimise auxiliary energy demand, fixed geometry/occupancy. Deterministic — no black-box AI.
            </p>
          )}
          {optimization && !optBusy && <OptimizationView report={optimization} materials={store.allMaterials} />}
        </div>
      </Card>

      <p className="mt-6 text-[11px] text-ink-400 leading-relaxed max-w-3xl">
        All comparisons use the same climate profile, comfort settings and simulation window. Numbers are outputs of the
        prototype screening engine — validate with high-fidelity tools before fabrication decisions.
      </p>
    </div>
  )
}

function OptimizationView({ report, materials }: { report: NonNullable<ReturnType<typeof getOptimization>>; materials: { id: string; name: string }[] }) {
  const best = report.bestCandidate
  const s = best.shelter
  const matNameL = (id: string) => materials.find((m) => m.id === id)?.name ?? id
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-4 gap-4">
        <StatBox label="Configurations evaluated" value={String(report.evaluated)} />
        <StatBox label="Feasible (comfort ≥ 80 %)" value={String(report.feasible)} />
        <StatBox label="Best comfort coverage" value={`${Math.round(best.result?.metrics.comfortPct ?? 0)} %`} tone="teal" />
        <StatBox label="Best aux demand" value={`${(best.result?.metrics.auxDemandKWh ?? 0).toFixed(1)} kWh`} tone="teal" />
      </div>

      {/* recommendation card */}
      <div className="rounded-xl border-2 border-teal-accent/30 bg-teal-soft/40 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Badge tone="teal">RECOMMENDED CONFIGURATION</Badge>
          <span className="text-xs text-ink-400">under the selected assumptions</span>
        </div>
        <h3 className="text-lg font-bold text-ink-900">{best.name}</h3>
        <p className="text-sm text-ink-600 mt-1">{report.recommendation.headline}</p>
        <div className="grid md:grid-cols-3 gap-x-8 gap-y-2 mt-4 text-sm">
          <Spec k="Location" v={report.designCaseId ? 'per design case' : ''} />
          <Spec k="Orientation" v={s.orientation} />
          <Spec k="Wall" v={matNameL(s.wallMaterialId)} />
          <Spec k="Roof" v={matNameL(s.roofMaterialId)} />
          <Spec k="Insulation" v={`${matNameL(s.insulationMaterialId)} · ${Math.round(s.insulationThicknessM * 1000)} mm`} />
          <Spec k="Window area" v={`${s.windowAreaM2.toFixed(1)} m²`} />
          <Spec k="Ventilation" v={`${s.ach.toFixed(1)} ACH (controlled)`} />
          <Spec k="Thermal mass" v={`${(s.extraThermalMassJk / 1e6).toFixed(1)} MJ/K extra`} />
        </div>
        <div className="grid md:grid-cols-2 gap-6 mt-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-accent mb-2">Why this configuration?</div>
            <ul className="space-y-1.5 text-[13px] text-ink-700">
              {report.recommendation.reasons.map((r, i) => (
                <li key={i} className="flex gap-2"><span className="text-teal-accent font-bold">✓</span>{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">Trade-offs to review</div>
            <ul className="space-y-1.5 text-[13px] text-ink-700">
              {report.recommendation.tradeoffs.map((r, i) => (
                <li key={i} className="flex gap-2"><span className="text-amber-600 font-bold">△</span>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ranking */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">Top configurations (of {report.evaluated} evaluated)</div>
        <div className="overflow-x-auto border border-ink-100 rounded-xl">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-400 text-xs uppercase bg-ink-50/60">
                <th className="px-4 py-2 font-semibold">#</th>
                <th className="px-4 py-2 font-semibold">Configuration</th>
                <th className="px-4 py-2 font-semibold">Comfort %</th>
                <th className="px-4 py-2 font-semibold">Aux kWh</th>
                <th className="px-4 py-2 font-semibold">Score</th>
                <th className="px-4 py-2 font-semibold">Feasible</th>
              </tr>
            </thead>
            <tbody>
              {report.ranking.map((r, i) => (
                <tr key={r.candidateId} className="border-t border-ink-50">
                  <td className="px-4 py-2 text-ink-400">{i + 1}</td>
                  <td className="px-4 py-2 font-mono text-xs text-ink-700">{r.name}</td>
                  <td className="px-4 py-2 tabular-nums font-semibold">{r.comfortPct}</td>
                  <td className="px-4 py-2 tabular-nums">{r.auxKWh.toFixed(1)}</td>
                  <td className="px-4 py-2 tabular-nums font-semibold text-teal-accent">{r.score.toFixed(2)}</td>
                  <td className="px-4 py-2">{r.feasible ? <Badge tone="teal">yes</Badge> : <Badge tone="amber">no</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Callout tone="info">
        <b>Method transparency:</b> {report.objective} {report.constraintNotes.join(' ')}
      </Callout>
    </div>
  )
}

function StatBox({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'teal' }) {
  return (
    <div className="bg-white border border-ink-200/80 rounded-xl px-4 py-3 shadow-card">
      <div className="text-[11px] uppercase tracking-wide text-ink-400 font-semibold">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${tone === 'teal' ? 'text-teal-accent' : 'text-ink-900'}`}>{value}</div>
    </div>
  )
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-ink-100/70 pb-1">
      <span className="text-ink-400 text-xs">{k}</span>
      <span className="font-semibold text-ink-800 text-[13px] text-right">{v}</span>
    </div>
  )
}

function QuickAdd({ title, desc, onAdd, count }: { title: string; desc: string; onAdd: () => void; count: number }) {
  return (
    <Card className="hover:border-teal-accent/40 transition-colors">
      <div className="p-5">
        <div className="text-sm font-bold text-ink-800">{title}</div>
        <p className="text-xs text-ink-400 mt-1 min-h-8">{desc}</p>
        <Button size="sm" variant="subtle" onClick={onAdd} className="mt-3">+ Add candidate</Button>
        <span className="ml-2 text-[11px] text-ink-300">{count} in list</span>
      </div>
    </Card>
  )
}

function matName(store: ReturnType<typeof useStore>, id: string): string {
  return store.allMaterials.find((m) => m.id === id)?.name ?? id
}

function shortName(n: string): string {
  return n.split('—')[0].trim() || n
}
