import { useMemo, useState } from 'react'
import type { DesignCase } from '../domain/types'
import { Badge, Button, Card, CardHead, Callout, EmptyState, SectionTitle } from '../ui/kit'
import { useStore } from '../ui/store'
import { generateReport, downloadMarkdown } from '../services/report'
import { buildComparison } from '../services/analysis'
import { TempChart, HeatFlowChart, ComfortTimeline, EnergyBalanceChart } from '../ui/charts'
import { LogoMark } from '../ui/brand'
import { getResult } from '../services/store'
import { findLocation } from '../data/locations'
import { getOptimization } from '../services/store'

/* ------------------------------------------------------------------
   Engineering report — printable document assembled from actual
   stored models, with charts rendered from the simulation series.
   ------------------------------------------------------------------ */

export default function Reports({ activeCaseId }: { activeCaseId: string | null }) {
  const store = useStore()
  const caseData: DesignCase | undefined = activeCaseId ? store.getCase(activeCaseId) : undefined
  const result = caseData ? getResult(caseData.id) : undefined

  if (!caseData || !result) {
    return (
      <Card>
        <EmptyState
          title={caseData ? 'No simulation result' : 'No design case selected'}
          sub={caseData
            ? 'Run the thermal simulation first — the report is assembled from actual computed results.'
            : 'Select a design case with a completed simulation.'}
        />
      </Card>
    )
  }

  const loc = findLocation(caseData.locationId)
  if (!loc) {
    return <Card><EmptyState title="Unknown location" sub="The design case references a location that no longer exists." /></Card>
  }

  return <ReportView caseData={caseData} />
}

function ReportView({ caseData }: { caseData: DesignCase }) {
  const store = useStore()
  const result = getResult(caseData.id)!
  const loc = findLocation(caseData.locationId)!
  const candidates = store.candidatesForCase(caseData.id).filter((c) => c.result)

  const generated = useMemo(() => generateReport({
    caseData, location: loc, result,
    comparison: candidates.length >= 2 ? buildComparison(caseData, candidates) : null,
    optimization: getOptimization(caseData.id) ?? null,
    materialsCatalog: store.allMaterials.map((m) => ({ id: m.id, name: m.name })),
  }), [caseData, loc, result, candidates, store.allMaterials])

  const [section, setSection] = useState<string | null>(null)

  return (
    <div className="animate-fadeUp">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Engineering Report</h1>
          <p className="text-sm text-ink-400 mt-1">Generated from actual simulation data — printable / exportable.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>🖨 Print / PDF</Button>
          <Button onClick={() => downloadMarkdown(generated.markdown, `vajra-report-${caseData.id}.md`)}>
            ⬇ Export Markdown
          </Button>
        </div>
      </div>

      {/* the document */}
      <Card className="print-page max-w-4xl mx-auto">
        <div className="px-8 py-7 border-b-2 border-ink-900">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <LogoMark size={26} />
                <span className="font-extrabold tracking-[0.18em] text-ink-900">VAJRA</span>
              </div>
              <h2 className="text-xl font-bold text-ink-900 mt-3">Engineering Analysis Report</h2>
              <p className="text-sm text-ink-500 mt-1">{caseData.name}</p>
            </div>
            <div className="text-right text-xs text-ink-400 leading-relaxed">
              <div>SIH 2026 · PS SIH26051</div>
              <div>Prototype screening analysis</div>
              <div>{new Date().toLocaleDateString()}</div>
              <div className="mt-2"><Badge tone="amber">Not a certified engineering deliverable</Badge></div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {generated.sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h3 className="text-[15px] font-bold text-ink-900 mb-2">{s.title}</h3>
              <ul className="space-y-1.5">
                {s.body.map((b, i) => (
                  <li key={i} className="text-[13px] text-ink-600 leading-relaxed flex gap-2">
                    <span className="text-ink-300 select-none">{b.startsWith('•') || b.startsWith('△') ? '' : '·'}</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {s.id === 'results' && (
                <>
                  <div className="mt-4 border border-ink-100 rounded-lg p-3">
                    <ChartLabel>Figure 1 — Outdoor vs indoor temperature (comfort band shaded)</ChartLabel>
                    <TempChart series={result.series} minC={caseData.settings.comfort.minC} maxC={caseData.settings.comfort.maxC} />
                  </div>
                  <div className="mt-3 border border-ink-100 rounded-lg p-3">
                    <ChartLabel>Figure 2 — Heat flow (gains vs losses)</ChartLabel>
                    <HeatFlowChart series={result.series} />
                  </div>
                </>
              )}
              {s.id === 'energy' && (
                <div className="mt-3 border border-ink-100 rounded-lg p-3">
                  <ChartLabel>Figure 3 — Cumulative energy balance</ChartLabel>
                  <EnergyBalanceChart series={result.series} />
                </div>
              )}
              {s.id === 'comparison' && candidates.length >= 2 && (
                <div className="mt-3 border border-ink-100 rounded-lg p-3">
                  <ChartLabel>Figure 4 — Comfort coverage across candidates</ChartLabel>
                  <ComfortTimeline series={candidates[0].result!.series} />
                </div>
              )}
              {s.id === 'validation' && (
                <Callout tone="teal">
                  Deterministic reproduction verified during prototype testing. Next validation steps: analytical
                  verification (ASHRAE 140-style tests), instrumented field trial, ANSYS high-fidelity comparison.
                </Callout>
              )}
            </section>
          ))}
        </div>

        <div className="px-8 py-5 border-t border-ink-100 text-[11px] text-ink-400">
          Generated by VAJRA prototype · climate {result.configSnapshot.climateProfileId} ·
          reference material properties · no DRDO-authorized data · figures computed from the stored simulation result.
        </div>
      </Card>
    </div>
  )
}

function ChartLabel({ children }: { children: string }) {
  return <div className="text-[11px] font-semibold text-ink-400 mb-1">{children}</div>
}
