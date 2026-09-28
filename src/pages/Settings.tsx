import { useState } from 'react'
import { Button, Card, CardHead, Callout, Field, Select, SectionTitle, Badge } from '../ui/kit'
import { useStore } from '../ui/store'
import { resetAll, countCompletedSimulations } from '../services/store'
import { listCachedProfiles } from '../climate/service'
import { cacheAllRepresentativeProfiles } from '../services/offline'

export default function Settings() {
  const store = useStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const profiles = listCachedProfiles()
  const sims = countCompletedSimulations()

  const preCache = () => {
    cacheAllRepresentativeProfiles()
  }

  return (
    <div className="animate-fadeUp">
      <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
      <p className="text-sm text-ink-400 mt-1 mb-5">Project, data and prototype-session controls.</p>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHead title="Project" />
          <div className="p-5 space-y-4">
            <Field label="Project name" hint="Shown in the top bar.">
              <TextInput
                value={store.settings.projectName}
                onChange={(v) => store.updateSettings({ projectName: v })}
              />
            </Field>
            <Field label="Offline mode indicator">
              <Select
                value={store.settings.offlineMode ? 'offline' : 'online'}
                onChange={(v) => store.updateSettings({ offlineMode: v === 'offline' })}
                options={[
                  { value: 'online', label: 'Online — climate provider reachable' },
                  { value: 'offline', label: 'Offline — use cached profiles only' },
                ]}
              />
            </Field>
            <Callout tone="teal">
              <b>Offline / remote-location concept:</b> acquire climate data once (NASA POWER, CSV upload or
              representative profiles), then run the full thermal workflow from the local cache. The simulation
              engine, material database and reports all execute locally.
            </Callout>
          </div>
        </Card>

        <Card>
          <CardHead title="Data & cache" />
          <div className="p-5 space-y-3 text-sm">
            <Row k="Design cases" v={String(store.cases.length)} />
            <Row k="Climate profiles cached" v={String(profiles.length)} />
            <Row k="Simulations completed" v={String(sims)} />
            <Row k="Custom materials" v={String(store.customMaterials.length)} />
            <div className="pt-2 flex flex-wrap gap-2">
              <Button variant="outline" onClick={preCache}>Cache all representative profiles</Button>
              {!confirmReset ? (
                <Button variant="danger" onClick={() => setConfirmReset(true)}>Reset prototype data…</Button>
              ) : (
                <>
                  <Button variant="danger" onClick={() => { resetAll(); location.reload() }}>Confirm full reset</Button>
                  <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
                </>
              )}
            </div>
            <p className="text-[11px] text-ink-400">
              Reset clears design cases, results, candidates, materials and the climate cache (representative
              profiles regenerate automatically on next use).
            </p>
          </div>
        </Card>
      </div>

      <SectionTitle>About this prototype</SectionTitle>
      <Card>
        <div className="p-5 text-[13px] text-ink-600 leading-relaxed space-y-2">
          <p>
            <b>VAJRA</b> — decision-support prototype for climate-adaptive shelter design
            (SIH 2026 Problem Statement SIH26051, DRDO).
          </p>
          <p>
            The thermal engine is a reduced-order single-zone transient RC model implemented in TypeScript for the
            prototype. A Python/FastAPI + NumPy/SciPy backend implementing the same JSON schemas is the production
            path; ANSYS is a future high-fidelity validation path and is not executing here.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge>Reference material data</Badge>
            <Badge>Representative climate data</Badge>
            <Badge tone="amber">Not a certified DRDO solver</Badge>
            <Badge tone="teal">Deterministic engine</Badge>
          </div>
        </div>
      </Card>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-ink-50 pb-1.5">
      <span className="text-ink-400 text-xs">{k}</span>
      <span className="font-semibold tabular-nums">{v}</span>
    </div>
  )
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-accent/30"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
