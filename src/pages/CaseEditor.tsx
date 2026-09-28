import { useMemo, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { DesignCase, Orientation, ShelterShape } from '../domain/types'
import { buildAssemblies } from '../engine/envelope'
import { LOCATIONS } from '../data/locations'
import { useStore } from '../ui/store'
import { newId } from '../services/ids'
import { defaultShelter, defaultSettings } from '../services/demo'
import { Card, CardHead, Button, Field, NumInput, Select, TextInput, Badge, Callout, SectionTitle } from '../ui/kit'
import { ShelterVisual } from '../ui/ShelterVisual'
import { getRepresentativeProfile, summarize } from '../climate/service'
import { checkCaseValid } from '../engine/simulateService'

/* ------------------------------------------------------------------
   Design case editor — a guided engineering form:
   Location & Climate → Shelter → Materials & Envelope → Simulation.
   ------------------------------------------------------------------ */

type Step = 0 | 1 | 2 | 3
const STEPS = ['Location & Climate', 'Shelter Geometry & Occupancy', 'Materials & Envelope', 'Simulation Settings']

export default function CaseEditor({ caseId, onDone, onCases, onCreated }: {
  caseId: string | null
  onDone: () => void
  onCases: () => void
  onCreated?: (id: string) => void
}) {
  const store = useStore()
  const existing = caseId ? store.getCase(caseId) : undefined

  const [step, setStep] = useState<Step>(0)
  const [name, setName] = useState(existing?.name ?? 'New Shelter Design')
  const [locationId, setLocationId] = useState(existing?.locationId ?? 'leh')
  const [shelter, setShelter] = useState(existing?.shelter ?? defaultShelter())
  const [settings, setSettings] = useState(existing?.settings ?? defaultSettings())

  const loc = LOCATIONS.find((l) => l.id === locationId) ?? LOCATIONS[0]

  const climateSummary = useMemo(() => {
    try {
      const profile = getRepresentativeProfile(loc)
      return summarize(profile.points)
    } catch {
      return null
    }
  }, [loc])

  const errors = useMemo(() => {
    const draft: DesignCase = {
      id: 'draft', name, createdAt: 0, updatedAt: 0,
      locationId, climateProfileId: `syn-${locationId}`,
      shelter, settings, status: 'draft',
    }
    return checkCaseValid(draft)
  }, [name, locationId, shelter, settings])

  const setS = (patch: Partial<typeof shelter>) => setShelter((s) => ({ ...s, ...patch }))

  const save = () => {
    if (errors.length) return
    if (existing) {
      store.updateCase({ ...existing, name, locationId, climateProfileId: `syn-${locationId}`, shelter, settings, updatedAt: Date.now() })
      onDone()
    } else {
      const now = Date.now()
      const c: DesignCase = {
        id: newId('case'), name, createdAt: now, updatedAt: now,
        locationId, climateProfileId: `syn-${locationId}`,
        shelter, settings, status: 'draft',
      }
      store.createCase(c)
      onCreated?.(c.id)
      onDone()
    }
  }

  const matOptions = (cats: string[]) =>
    store.allMaterials.filter((m) => cats.some((c) => (m.category as string[]).includes(c))).map((m) => ({ value: m.id, label: m.name }))

  return (
    <div className="animate-fadeUp">
      {/* header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <button className="text-xs text-ink-400 hover:text-ink-700 mb-1" onClick={onCases}>← All design cases</button>
          <h1 className="text-2xl font-bold text-ink-900">{existing ? 'Configure Design Case' : 'New Design Case'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {errors.length === 0 && <Badge tone="teal">Valid</Badge>}
          {errors.length > 0 && <Badge tone="amber">{errors.length} issue{errors.length > 1 ? 's' : ''}</Badge>}
          <Button onClick={save} disabled={errors.length > 0}>{existing ? 'Save Case' : 'Create & Continue'}</Button>
        </div>
      </div>

      {/* step tabs */}
      <div className="flex gap-1 bg-ink-100/70 p-1 rounded-xl mb-5">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i as Step)}
            className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
              step === i ? 'bg-white text-ink-900 shadow-card' : 'text-ink-400 hover:text-ink-600'
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* CASE NAME + LOCATION step */}
      {step === 0 && (
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
          <Card>
            <CardHead title="Design case" sub="Name this study; it groups the shelter, climate and results." />
            <div className="p-5 space-y-4">
              <Field label="Case name">
                <TextInput value={name} onChange={setName} placeholder="e.g. Leh Winter Detachment Shelter" />
              </Field>
              <Field label="Location" hint="Coordinates are used only to identify the geographic point for climate lookup — the software does not need to be physically present there.">
                <Select
                  value={locationId}
                  onChange={setLocationId}
                  options={LOCATIONS.map((l) => ({ value: l.id, label: `${l.name}, ${l.region} — ${l.climateZone}` }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Kv k="Latitude" v={`${loc.lat.toFixed(2)}°`} />
                <Kv k="Longitude" v={`${loc.lon.toFixed(2)}°`} />
                <Kv k="Elevation" v={`${loc.elevationM} m`} />
                <Kv k="Climate zone" v={loc.climateZone} />
              </div>
              <Callout tone="teal">
                <b>Data source:</b> NASA POWER (hourly, live when reachable) with an automatic fallback to the cached
                representative profile. The simulation always uses a <b>Representative / Historical climate time series</b> — never a live forecast.
              </Callout>
            </div>
          </Card>
          <Card>
            <CardHead title="Climate preview" sub="Representative year — full series is cached for offline analysis." />
            <div className="p-5">
              {climateSummary ? (
                <div className="grid grid-cols-2 gap-3">
                  <Kv k="Mean temp" v={`${climateSummary.avgTempC.toFixed(1)} °C`} />
                  <Kv k="Min / Max" v={`${climateSummary.minTempC.toFixed(0)} / ${climateSummary.maxTempC.toFixed(0)} °C`} />
                  <Kv k="Insolation" v={`${climateSummary.insolationKWhM2Day.toFixed(2)} kWh/m²·d`} />
                  <Kv k="Mean RH" v={`${climateSummary.avgRH.toFixed(0)} %`} />
                  <Kv k="Wind" v={`${climateSummary.avgWindMs.toFixed(1)} m/s`} />
                  <Kv k="Hours cached" v={`${climateSummary.hours}`} />
                </div>
              ) : (
                <p className="text-sm text-ink-400">Climate profile unavailable — check Settings.</p>
              )}
              <div className="mt-4">
                <ClimateMiniSpark locId={loc.id} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* SHELTER step */}
      {step === 1 && (
        <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-5">
          <div className="space-y-5">
            <Card>
              <CardHead title="Geometry" sub="Drive the schematic by editing values — the section view updates live." />
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Length"><NumInput value={shelter.lengthM} onChange={(v) => setS({ lengthM: v })} min={1} max={30} step={0.5} suffix="m" /></Field>
                <Field label="Width"><NumInput value={shelter.widthM} onChange={(v) => setS({ widthM: v })} min={1} max={15} step={0.5} suffix="m" /></Field>
                <Field label="Height"><NumInput value={shelter.heightM} onChange={(v) => setS({ heightM: v })} min={1} max={6} step={0.1} suffix="m" /></Field>
                <Field label="Shape">
                  <Select value={shelter.shape} onChange={(v) => setS({ shape: v })} options={[
                    { value: 'rectangular', label: 'Rectangular' },
                    { value: 'quonset', label: 'Quonset (arch)' },
                    { value: 'domed', label: 'Domed' },
                  ]} />
                </Field>
                <Field label="Orientation (glazing facade)" hint="Affects solar gain distribution.">
                  <Select value={shelter.orientation} onChange={(v) => setS({ orientation: v })} options={ORIENTATIONS.map((o) => ({ value: o, label: ORIENT_LABELS[o] }))} />
                </Field>
                <div />
                <div />
                <div />
              </div>
            </Card>
            <Card>
              <CardHead title="Occupancy & internal loads" />
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Occupants"><NumInput value={shelter.occupants} onChange={(v) => setS({ occupants: v })} min={0} max={40} /></Field>
                <Field label="Activity level">
                  <Select value={shelter.activity} onChange={(v) => setS({ activity: v })} options={[
                    { value: 'resting', label: 'Resting (70 W each)' },
                    { value: 'seated-light', label: 'Seated, light work (100 W)' },
                    { value: 'moderate', label: 'Moderate (145 W)' },
                  ]} />
                </Field>
                <Field label="Equipment load"><NumInput value={shelter.internalLoadW} onChange={(v) => setS({ internalLoadW: v })} min={0} max={3000} step={50} suffix="W" /></Field>
                <Field label="Extra thermal mass" hint="e.g. water drums, sandbags — adds heat storage.">
                  <NumInput value={shelter.extraThermalMassJk / 1e6} onChange={(v) => setS({ extraThermalMassJk: v * 1e6 })} min={0} max={20} step={0.5} suffix="MJ/K" />
                </Field>
              </div>
            </Card>
            <Card>
              <CardHead title="Openings & ventilation" />
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Window count"><NumInput value={shelter.windowCount} onChange={(v) => setS({ windowCount: v })} min={0} max={10} /></Field>
                <Field label="Total window area"><NumInput value={shelter.windowAreaM2} onChange={(v) => setS({ windowAreaM2: v })} min={0} max={20} step={0.1} suffix="m²" /></Field>
                <Field label="Door area"><NumInput value={shelter.doorAreaM2} onChange={(v) => setS({ doorAreaM2: v })} min={0} max={6} step={0.1} suffix="m²" /></Field>
                <Field label="Ventilation rate" hint="Air changes per hour (infiltration adds wind-driven share).">
                  <NumInput value={shelter.ach} onChange={(v) => setS({ ach: v })} min={0.2} max={15} step={0.1} suffix="ACH" />
                </Field>
              </div>
            </Card>
          </div>
          <div className="space-y-5">
            <Card>
              <CardHead title="Live section view" sub={`${(shelter.lengthM * shelter.widthM).toFixed(1)} m² floor · ${(shelter.lengthM * shelter.widthM * shelter.heightM).toFixed(1)} m³ volume`} />
              <div className="p-4">
                <ShelterVisual shelter={shelter} />
              </div>
            </Card>
            <Callout tone="info">
              The schematic is qualitative — it updates with your dimensions to keep the engineer oriented.
              Thermal behaviour is computed by the transient heat-balance engine, not by this drawing.
            </Callout>
          </div>
        </div>
      )}

      {/* MATERIALS step */}
      {step === 2 && (
        <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-5">
          <Card>
            <CardHead title="Envelope materials" sub="Reference / prototype property sets — replaceable by authorized data later." />
            <div className="p-5 grid grid-cols-2 gap-4">
              <Field label="Wall material"><Select value={shelter.wallMaterialId} onChange={(v) => setS({ wallMaterialId: v })} options={matOptions(['wall'])} /></Field>
              <Field label="Roof material"><Select value={shelter.roofMaterialId} onChange={(v) => setS({ roofMaterialId: v })} options={matOptions(['roof'])} /></Field>
              <Field label="Floor material"><Select value={shelter.floorMaterialId} onChange={(v) => setS({ floorMaterialId: v })} options={matOptions(['floor'])} /></Field>
              <Field label="Insulation material"><Select value={shelter.insulationMaterialId} onChange={(v) => setS({ insulationMaterialId: v })} options={matOptions(['insulation'])} /></Field>
              <Field label="Insulation thickness" hint="Applied to walls, roof and 50 % to floor.">
                <NumInput value={shelter.insulationThicknessM * 1000} onChange={(v) => setS({ insulationThicknessM: v / 1000 })} min={0} max={500} step={5} suffix="mm" />
              </Field>
            </div>
          </Card>
          <Card>
            <CardHead title="Computed envelope" sub="From the reference material database." />
            <div className="p-5 space-y-3">
              <EnvelopePreview shelter={shelter} materials={store.allMaterials} />
              <Callout tone="warn">
                Reference / Prototype Property — publicly available typical values for screening only.
                Not DRDO-authorized data.
              </Callout>
            </div>
          </Card>
        </div>
      )}

      {/* SETTINGS step */}
      {step === 3 && (
        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <CardHead title="Simulation window" />
            <div className="p-5 grid grid-cols-2 gap-4">
              <Field label="Duration" hint="Hours simulated from the start of the climate profile.">
                <NumInput value={settings.days} onChange={(v) => setSettings((s) => ({ ...s, days: v }))} min={1} max={30} suffix="days" />
              </Field>
              <Field label="Timestep">
                <Select value={String(settings.timestepMin)} onChange={(v) => setSettings((s) => ({ ...s, timestepMin: Number(v) }))} options={[
                  { value: '15', label: '15 min' },
                  { value: '10', label: '10 min' },
                  { value: '5', label: '5 min (default)' },
                  { value: '1', label: '1 min (slow)' },
                ]} />
              </Field>
            </div>
          </Card>
          <Card>
            <CardHead title="Comfort criterion" sub="Prototype comfort criterion — configurable for validation." />
            <div className="p-5 grid grid-cols-2 gap-4">
              <Field label="Band minimum"><NumInput value={settings.comfort.minC} onChange={(v) => setSettings((s) => ({ ...s, comfort: { ...s.comfort, minC: v } }))} min={5} max={30} step={0.5} suffix="°C" /></Field>
              <Field label="Band maximum"><NumInput value={settings.comfort.maxC} onChange={(v) => setSettings((s) => ({ ...s, comfort: { ...s.comfort, maxC: v } }))} min={10} max={40} step={0.5} suffix="°C" /></Field>
            </div>
            <div className="px-5 pb-5">
              <Callout tone="teal">
                The comfort band drives both the comfort-hours metric and the auxiliary energy demand estimate.
                PMV/PPD is computed as a screening indicator alongside the band.
              </Callout>
            </div>
          </Card>
        </div>
      )}

      {/* footer nav */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1) as Step)} disabled={step === 0}>← Back</Button>
        <div className="flex gap-2">
          {step < 3 && <Button variant="outline" onClick={() => setStep((s) => Math.min(3, s + 1) as Step)}>Next: {STEPS[step + 1]} →</Button>}
          <Button onClick={save} disabled={errors.length > 0}>{existing ? 'Save Case' : 'Create & Continue'}</Button>
        </div>
      </div>
    </div>
  )
}

const ORIENTATIONS: Orientation[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const ORIENT_LABELS: Record<Orientation, string> = {
  N: 'North', NE: 'North-East', E: 'East', SE: 'South-East',
  S: 'South', SW: 'South-West', W: 'West', NW: 'North-West',
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-ink-50 pb-1.5">
      <span className="text-ink-400">{k}</span>
      <span className="font-semibold text-ink-700 tabular-nums text-right">{v}</span>
    </div>
  )
}

function EnvelopePreview({ shelter, materials }: { shelter: ShelterT; materials: Material[] }) {
  const asm = buildAssembliesPreview(shelter, materials)
  return (
    <div className="space-y-3">
      <LayerStack title="Wall" layers={asm.wall.layers} u={asm.wall.u} />
      <LayerStack title="Roof" layers={asm.roof.layers} u={asm.roof.u} />
      <LayerStack title="Floor" layers={asm.floor.layers} u={asm.floor.u} />
    </div>
  )
}

function LayerStack({ title, layers, u }: { title: string; layers: { name: string; thicknessM: number; uContrib: number }[]; u: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-ink-600">{title}</span>
        <span className="font-mono text-ink-500">U = {u.toFixed(2)} W/m²K</span>
      </div>
      <div className="flex h-7 rounded-lg overflow-hidden border border-ink-200">
        {layers.length === 0 && <div className="flex-1 bg-ink-50 flex items-center justify-center text-[11px] text-ink-400">no layers</div>}
        {layers.map((l, i) => (
          <div
            key={i}
            className={`flex items-center justify-center text-[10px] font-semibold text-white ${i % 2 ? 'bg-ink-700' : 'bg-ink-500'}`}
            style={{ flexGrow: Math.max(0.5, l.thicknessM) }}
            title={`${l.name} · ${Math.round(l.thicknessM * 1000)} mm · R = ${(1 / Math.max(1e-6, l.uContrib)).toFixed(2)}`}
          >
            <span className="truncate px-1">{l.name} · {Math.round(l.thicknessM * 1000)} mm</span>
  </div>
        ))}
      </div>
    </div>
  )
}

function ClimateMiniSpark({ locId }: { locId: string }) {
  const data = useMemo(() => {
    const loc = LOCATIONS.find((l) => l.id === locId)
    if (!loc) return []
    const profile = getRepresentativeProfile(loc)
    return profile.points.slice(0, 24 * 10).map((p) => ({ t: p.t, temp: p.temp }))
  }, [locId])
  return <ClimateChart data={data} />
}

function ClimateChart({ data }: { data: { t: string; temp: number }[] }) {
  return (
    <div className="h-36">
      <ResponsiveMiniChart data={data} />
    </div>
  )
}

function ResponsiveMiniChart({ data }: { data: { t: string; temp: number }[] }) {
  const fmt = (t: string) => t.slice(5, 10) + ' ' + t.slice(11, 13) + 'h'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#7492ac' }} tickFormatter={fmt} minTickGap={30} />
        <YAxis tick={{ fontSize: 10, fill: '#7492ac' }} width={30} unit="°" />
        <Tooltip />
        <Area type="monotone" dataKey="temp" stroke="#2563eb" fill="#2563eb18" strokeWidth={1.8} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// local type aliases
type ShelterT = import('../domain/types').Shelter
type Material = import('../domain/types').Material

function buildAssembliesPreview(shelter: ShelterT, materials: Material[]) {
  return buildAssemblies(shelter, materials)
}
