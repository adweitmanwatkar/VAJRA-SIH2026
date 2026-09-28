import { useMemo, useState } from 'react'
import type { Material } from '../domain/types'
import { REFERENCE_MATERIALS } from '../data/materials'
import { Badge, Button, Card, CardHead, Callout, Field, NumInput, SectionTitle, TextInput, Select, EmptyState } from '../ui/kit'
import { useStore } from '../ui/store'
import { newId } from '../services/ids'

/* ------------------------------------------------------------------
   Material library — reference properties + user-defined materials.
   Everything is labeled as reference/prototype data.
   ------------------------------------------------------------------ */

type Cat = 'wall' | 'roof' | 'floor' | 'insulation'
const CATS: Cat[] = ['wall', 'roof', 'floor', 'insulation']
const CAT_LABEL: Record<Cat, string> = { wall: 'Wall', roof: 'Roof', floor: 'Floor', insulation: 'Insulation' }

export default function Materials() {
  const store = useStore()
  const [filter, setFilter] = useState<Cat | 'all'>('all')
  const [showForm, setShowForm] = useState(false)

  const materials = useMemo(() => {
    const all = [...REFERENCE_MATERIALS, ...store.customMaterials]
    return filter === 'all' ? all : all.filter((m) => (m.category as string[]).includes(filter))
  }, [filter, store.customMaterials])

  return (
    <div className="animate-fadeUp">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Material Database</h1>
          <p className="text-sm text-ink-400 mt-1">
            Reference / Prototype Property sets — publicly available typical values, replaceable by authorized data.
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={filter}
            onChange={setFilter}
            options={[{ value: 'all', label: 'All categories' }, ...CATS.map((c) => ({ value: c, label: CAT_LABEL[c] }))]}
          />
          <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ Add custom material'}</Button>
        </div>
      </div>

      <Callout tone="warn">
        <b>Reference / Prototype Property.</b> Values are typical published figures for screening-level analysis.
        They are not DRDO-authorized data. The schema is parameterized so an authorized dataset can replace this
        library without changing the simulation engine.
      </Callout>

      {/* custom material form */}
      {showForm && (
        <div className="mt-4">
          <CustomMaterialForm
            onAdd={(m) => { store.addMaterial(m); setShowForm(false) }}
          />
        </div>
      )}

      <SectionTitle>Library</SectionTitle>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {materials.map((m) => (
          <Card key={m.id}>
            <CardHead
              title={m.name}
              sub={m.category.map((c) => CAT_LABEL[c as Cat]).join(' · ')}
              right={m.isReference ? <Badge>Reference</Badge> : <Badge tone="teal">Custom</Badge>}
            />
            <div className="p-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <Kv k="Density ρ" v={`${m.density} kg/m³`} />
                <Kv k="Conductivity k" v={`${m.conductivity} W/m·K`} />
                <Kv k="Specific heat c" v={`${m.specificHeat} J/kg·K`} />
                <Kv k="Thickness" v={`${Math.round(m.thickness * 1000)} mm`} />
                <Kv k="R-value (layer)" v={`${(m.thickness / m.conductivity).toFixed(2)} m²K/W`} />
                <Kv k="Volumetric heat" v={`${((m.density * m.specificHeat) / 1e6).toFixed(2)} MJ/m³K`} />
              </div>
              <p className="text-[11px] text-ink-400 mt-3 leading-relaxed">{m.note}</p>
              {!m.isReference && (
                <Button size="sm" variant="danger" className="mt-3" onClick={() => store.removeMaterial(m.id)}>Delete</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      {materials.length === 0 && <Card><EmptyState title="No materials in this category" /></Card>}
    </div>
  )
}

function CustomMaterialForm({ onAdd }: { onAdd: (m: Material) => void }) {
  const [name, setName] = useState('')
  const [density, setDensity] = useState(500)
  const [conductivity, setConductivity] = useState(0.1)
  const [specificHeat, setSpecificHeat] = useState(1000)
  const [thickness, setThickness] = useState(50)
  const [cat, setCat] = useState<Cat>('wall')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!name.trim()) { setError('Name is required.'); return }
    if (!(density > 0) || !(conductivity > 0) || !(specificHeat > 0)) {
      setError('Density, conductivity and specific heat must be positive numbers.')
      return
    }
    if (!(thickness > 0)) { setError('Thickness must be positive.'); return }
    setError(null)
    onAdd({
      id: newId('mat'),
      name: name.trim(),
      category: [cat],
      density, conductivity, specificHeat,
      thickness: thickness / 1000,
      isReference: false,
      note: 'User-defined material (prototype property entry).',
    })
    setName('')
  }

  return (
    <Card>
      <CardHead title="Add custom material" sub="Fields: name, density, conductivity, specific heat, thickness" />
      <div className="p-5 grid md:grid-cols-3 gap-4">
        <Field label="Name"><TextInput value={name} onChange={setName} placeholder="e.g. Aerogel Blanket" /></Field>
        <Field label="Category">
          <Select value={cat} onChange={setCat} options={CATS.map((c) => ({ value: c, label: CAT_LABEL[c] }))} />
        </Field>
        <Field label="Density"><NumInput value={density} onChange={setDensity} min={1} step={10} suffix="kg/m³" /></Field>
        <Field label="Thermal conductivity"><NumInput value={conductivity} onChange={setConductivity} min={0.005} step={0.005} suffix="W/m·K" /></Field>
        <Field label="Specific heat"><NumInput value={specificHeat} onChange={setSpecificHeat} min={100} step={50} suffix="J/kg·K" /></Field>
        <Field label="Thickness"><NumInput value={thickness} onChange={setThickness} min={1} step={5} suffix="mm" /></Field>
      </div>
      <div className="px-5 pb-5 flex items-center gap-3">
        <Button onClick={submit}>Add to library</Button>
        {error && <span className="text-xs text-red-600 font-medium">{error}</span>}
      </div>
    </Card>
  )
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-ink-50 pb-1">
      <span className="text-ink-400">{k}</span>
      <span className="font-semibold text-ink-700 tabular-nums text-right">{v}</span>
    </div>
  )
}
