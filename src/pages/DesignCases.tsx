import type { DesignCase } from '../domain/types'
import { Badge, Button, Card, CardHead, EmptyState } from '../ui/kit'
import { findLocation } from '../data/locations'
import { getResult } from '../services/store'

export default function DesignCases({ cases, onSelect, onCreate }: {
  cases: DesignCase[]
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  return (
    <div className="animate-fadeUp">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Design Cases</h1>
          <p className="text-sm text-ink-400 mt-1">One case = one location + climate profile + shelter configuration.</p>
        </div>
        <Button onClick={onCreate}>+ New Design Case</Button>
      </div>

      {cases.length === 0 ? (
        <Card>
          <EmptyState
            title="No design cases yet"
            sub="Create a case to configure a shelter, load climate data and run the thermal simulation."
            action={<Button onClick={onCreate}>Create Design Case</Button>}
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cases.map((c) => {
            const loc = findLocation(c.locationId)
            const hasResult = !!getResult(c.id)
            return (
            <Card key={c.id}>
              <CardHead
                title={c.name}
                sub={`${loc?.name ?? c.locationId} · ${loc?.climateZone ?? ''}`}
                right={hasResult ? <Badge tone="teal">Simulated</Badge> : <Badge>Draft</Badge>}
              />
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-500">
                  <Kv k="Occupants" v={`${c.shelter.occupants}`} />
                  <Kv k="Orientation" v={c.shelter.orientation} />
                  <Kv k="Insulation" v={`${Math.round(c.shelter.insulationThicknessM * 1000)} mm`} />
                  <Kv k="Window" v={`${c.shelter.windowAreaM2.toFixed(1)} m²`} />
                  <Kv k="ACH" v={c.shelter.ach.toFixed(1)} />
                  <Kv k="Window (days)" v={`${c.settings.days} d`} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onSelect(c.id)}>Configure</Button>
                </div>
              </div>
            </Card>
            )
          })}
        </div>
      )}
    </div>
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
