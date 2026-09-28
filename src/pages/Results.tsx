import { useMemo, useState } from 'react'
import type { DesignCase } from '../domain/types'
import { Badge, Button, Card, CardHead, Callout, EmptyState, StatTile, SectionTitle } from '../ui/kit'
import { TempChart, HeatFlowChart, ComfortTimeline, EnergyBalanceChart } from '../ui/charts'
import { EnergyFlowStrip } from '../ui/ShelterVisual'
import { getResult } from '../services/store'
import { findLocation } from '../data/locations'
import { resolveProfile } from '../engine/simulateService'
import { summarize } from '../climate/service'
import { buildAssemblies } from '../engine/envelope'
import { REFERENCE_MATERIALS } from '../data/materials'

/* ------------------------------------------------------------------
   Results dashboard — the most important screen. All numbers come
   from the stored SimulationResult; charts render the actual series.
   ------------------------------------------------------------------ */

export default function Results({ caseData, onGoCompare, onGoSim }: {
  caseData: DesignCase | undefined
  onGoCompare: () => void
  onGoSim: () => void
}) {
  const result = caseData ? getResult(caseData.id) : undefined
  const [hourIdx, setHourIdx] = useState<number | null>(null)

  if (!caseData) {
    return (
      <Card>
        <EmptyState title="No design case selected" sub="Run a simulation first." />
      </Card>
    )
  }
  if (!result) {
    return (
      <Card>
        <EmptyState
          title="No simulation results yet"
          sub={`Run the thermal simulation for “${caseData.name}” to populate this dashboard.`}
          action={<Button onClick={onGoSim}>Go to Simulation</Button>}
        />
      </Card>
    )
  }

  const m = result.metrics
  const loc = findLocation(caseData.locationId)
  const avgHourIdx = pickIndexAtHour(result.series, 13)

  return (
    <div className="animate-fadeUp">
      {/* header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Results — {caseData.name}</h1>
          <p className="text-sm text-ink-400 mt-1">
            {loc ? `${loc.name}, ${loc.region}` : caseData.locationId} · {result.configSnapshot.settings.days}-day hourly transient ·
            ran {new Date(result.ranAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onGoSim}>Re-configure</Button>
          <Button onClick={onGoCompare}>Compare Designs →</Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatTile label="Avg Indoor Temp" value={m.avgTempInC.toFixed(1)} unit="°C" tone="teal" hint={`outdoor ${m.avgTempOutC.toFixed(1)} °C`} />
        <StatTile label="Comfort" value={`${Math.round(m.comfortPct)}%`} hint={`${m.comfortHours} of ${m.totalHours} h in band`} tone={m.comfortPct >= 80 ? 'teal' : m.comfortPct >= 60 ? 'amber' : 'red'} />
        <StatTile label="Solar Gain" value={m.solarGainKWh.toFixed(1)} unit="kWh" hint="glazing + absorbed opaque" />
        <StatTile label="Heat Loss (cond.)" value={m.conductionKWh.toFixed(1)} unit="kWh" hint="envelope + openings + floor" />
        <StatTile label="Vent. Loss" value={m.ventilationKWh.toFixed(1)} unit="kWh" hint="ACH-driven" />
        <StatTile label="Aux. Energy Demand" value={m.auxDemandKWh.toFixed(1)} unit="kWh" tone="amber" hint="ideal system holding band" />
      </div>

      {/* animated energy flow strip */}
      <div className="mt-5">
        <EnergyFlowStrip
          solar={hourIdx != null ? result.series[hourIdx].solarGain : result.series[avgHourIdx]?.solarGain ?? 0}
          internal={hourIdx != null ? result.series[hourIdx].internal : result.series[avgHourIdx]?.internal ?? 0}
          conduction={hourIdx != null ? result.series[hourIdx].conduction : result.series[avgHourIdx]?.conduction ?? 0}
          ventilation={hourIdx != null ? result.series[hourIdx].ventilation : result.series[avgHourIdx]?.ventilation ?? 0}
        />
      </div>

      {/* Chart 1 + 2 */}
      <div className="grid xl:grid-cols-2 gap-4 mt-5">
        <Card>
          <CardHead
            title="Outdoor vs Indoor Temperature"
            sub="Shaded band = configured comfort range"
            right={
              <HourScrubber
                series={result.series}
                value={hourIdx ?? avgHourIdx}
                onChange={setHourIdx}
              />
            }
          />
          <div className="p-3 pb-4">
            <TempChart series={result.series} minC={caseData.settings.comfort.minC} maxC={caseData.settings.comfort.maxC} />
          </div>
        </Card>
        <Card>
          <CardHead title="Heat Flow" sub="Instantaneous gains and losses (W)" />
          <div className="p-3 pb-4">
            <HeatFlowChart series={result.series} />
          </div>
        </Card>
      </div>

      {/* Chart 3 + 4 */}
      <div className="grid xl:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHead title="Comfort Timeline" sub="Hourly status vs comfort band" />
          <div className="p-3 pb-4">
            <ComfortTimeline series={result.series} />
          </div>
        </Card>
        <Card>
          <CardHead title="Cumulative Energy Balance" sub="Where heat enters and leaves over the window" />
          <div className="p-3 pb-4">
            <EnergyBalanceChart series={result.series} />
          </div>
        </Card>
      </div>

      {/* comfort analysis */}
      <SectionTitle>Comfort Analysis</SectionTitle>
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <Card>
          <CardHead
            title="Comfort accounting"
            sub="Prototype comfort criterion — configurable for validation"
            right={<Badge tone="teal">Band {caseData.settings.comfort.minC}–{caseData.settings.comfort.maxC} °C</Badge>}
          />
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Kv k="Comfortable hours" v={`${m.comfortHours} h (${Math.round(m.comfortPct)} %)`} />
            <Kv k="Below band" v={`${m.totalHours - m.comfortHours - countAbove(result.series)} h`} />
            <Kv k="Above band" v={`${countAbove(result.series)} h`} />
            <Kv k="Avg indoor temp" v={`${m.avgTempInC.toFixed(1)} °C`} />
            <Kv k="Min indoor temp" v={`${m.minTempInC.toFixed(1)} °C`} />
            <Kv k="Max indoor temp" v={`${m.maxTempInC.toFixed(1)} °C`} />
            <Kv k="Underheat (°C·h)" v={m.underheatCh.toFixed(0)} />
            <Kv k="Overheat (°C·h)" v={m.overheatCh.toFixed(0)} />
            <Kv k="Mean PPD" v={m.avgPpd != null ? `${m.avgPpd.toFixed(0)} %` : '—'} />
          </div>
        </Card>
        <Card>
          <CardHead title="PMV / PPD screening indicator" sub="Fanger-form approximation" />
          <div className="p-5 text-[13px] text-ink-600 leading-relaxed">
            <p>
              Computed with stated assumptions: metabolic rate from activity level, clothing 0.9 clo,
              air speed 0.15 m/s, radiant temperature ≈ air temperature (small enclosure).
            </p>
            <div className="mt-3 space-y-2">
              <Meter label="Cold ← PMV → Hot" value={m.avgPpd != null ? (m.avgPpd < 1 ? 0 : m.avgPpd) : 0} />
            </div>
            <Callout tone="info">
              <b>Not a substitute for a full thermal-comfort standard calculation.</b> The comfort band is the
              governing criterion; PMV/PPD is shown for engineering context only.
            </Callout>
          </div>
        </Card>
      </div>

      {/* assumptions */}
      <SectionTitle>Assumptions & Model</SectionTitle>
      <AssumptionsPanel caseData={caseData} />

      <p className="mt-6 text-[11px] text-ink-400 leading-relaxed max-w-3xl">
        Screening model output. Not a certified engineering analysis. High-fidelity validation is required before
        fabrication decisions.
      </p>
    </div>
  )
}

/* ------------------------------- helpers ------------------------------ */

function countAbove(series: { comfort: { band: string } }[]): number {
  return series.filter((p) => p.comfort.band === 'above').length
}

function pickIndexAtHour(series: { t: string }[], hour: number): number {
  const idx = series.findIndex((p) => Number(p.t.slice(11, 13)) === hour)
  return idx >= 0 ? idx : 0
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-ink-50 pb-1.5">
      <div className="text-[11px] text-ink-400">{k}</div>
      <div className="font-semibold text-ink-800 tabular-nums">{v}</div>
    </div>
  )
}

function Meter({ label, value }: { label: string; value: number }) {
  // PMV −3..+3 mapped to 0..1
  const pct = Math.max(0, Math.min(1, (value + 3) / 6)) * 100
  return (
    <div>
      <div className="flex justify-between text-[11px] text-ink-400 mb-1"><span>{label}</span><span className="font-mono">{value.toFixed(2)}</span></div>
      <div className="h-2 rounded-full bg-ink-100 relative overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-ink-300" />
        <div className="absolute inset-y-0 rounded-full bg-teal-accent/70" style={{ left: `${Math.min(50, pct)}%`, width: `${Math.abs(pct - 50)}%` }} />
      </div>
    </div>
  )
}

function HourScrubber({ series, value, onChange }: {
  series: { t: string }[]
  value: number
  onChange: (v: number | null) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={Math.max(0, series.length - 1)}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40 accent-teal-accent"
        title="Scrub through hours — updates the flow strip"
      />
      <span className="text-[11px] font-mono text-ink-400 w-24">{series[value]?.t.slice(5, 16) ?? ''}</span>
      <button className="text-[11px] text-ink-400 hover:text-ink-700" onClick={() => onChange(null)}>reset</button>
    </div>
  )
}

function AssumptionsPanel({ caseData }: { caseData: DesignCase }) {
  const profile = useMemo(() => {
    try { return resolveProfile(caseData) } catch { return null }
  }, [caseData])
  const s = profile ? summarize(profile.points.slice(0, caseData.settings.days * 24)) : null
  return (
    <Card>
      <CardHead
        title="Assumptions & Model — full transparency"
        sub="Everything the numbers depend on, stated openly"
        right={<Badge>Prototype / screening model</Badge>}
      />
      <div className="p-5 grid md:grid-cols-2 xl:grid-cols-3 gap-4 text-[13px]">
        <div className="space-y-1.5">
          <H>Climate</H>
          <Kv k="Source" v={profile ? profile.source : 'unavailable'} />
          <Kv k="Kind" v={profile ? `${profile.kind} · ${profile.sourceNote.slice(0, 60)}…` : '—'} />
          <Kv k="Period" v={profile ? `${profile.points[0]?.t.slice(0, 10)} → ${profile.points[caseData.settings.days * 24 - 1]?.t.slice(0, 10)}` : '—'} />
          <Kv k="Resolution" v="Hourly" />
        </div>
        <div className="space-y-1.5">
          <H>Model</H>
          <Kv k="Type" v="Single-zone transient RC heat balance" />
          <Kv k="Integration" v={`Explicit Euler · ${caseData.settings.timestepMin} min`} />
          <Kv k="Envelope" v={`U-wall ${fmtU(caseData)} · insulation ${Math.round(caseData.shelter.insulationThicknessM * 1000)} mm`} />
          <Kv k="Glazing" v="U 5.8 W/m²K · SHGC 0.55 (reference)" />
        </div>
        <div className="space-y-1.5">
          <H>Boundaries</H>
          <Kv k="Ground node" v="Annual mean − 2 °C" />
          <Kv k="Ventilation" v={`${caseData.shelter.ach.toFixed(1)} ACH + wind-driven infiltration`} />
          <Kv k="Internal gains" v={`${caseData.shelter.occupants} × activity W + ${caseData.shelter.internalLoadW} W equipment`} />
          <Kv k="Comfort criterion" v={`Band ${caseData.settings.comfort.minC}–${caseData.settings.comfort.maxC} °C (configurable)`} />
        </div>
      </div>
      <div className="px-5 pb-5">
        <Callout tone="warn">
          <b>Prototype / screening model.</b> Results guide comparison and early trade-offs. High-fidelity validation
          is required before engineering deployment.
        </Callout>
      </div>
    </Card>
  )
}

function H({ children }: { children: string }) {
  return <div className="text-[11px] font-bold uppercase tracking-wider text-teal-accent">{children}</div>
}

function fmtU(caseData: DesignCase): string {
  try {
    const asm = buildAssemblies(caseData.shelter, REFERENCE_MATERIALS)
    return `${asm.wall.u.toFixed(2)} W/m²K`
  } catch {
    return 'per assembly'
  }
}
