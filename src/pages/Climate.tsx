import { useMemo, useState } from 'react'
import type { ClimateProfile, DesignCase } from '../domain/types'
import { LOCATIONS, findLocation } from '../data/locations'
import { Badge, Button, Card, CardHead, Callout, SectionTitle, StatTile } from '../ui/kit'
import { ClimateTempChart, ClimateSolarChart } from '../ui/charts'
import {
  listCachedProfiles, getRepresentativeProfile, summarize, cacheProfile, deleteCachedProfile,
  parseClimateCsv, fetchOrFallback,
} from '../climate/service'
import type { PowerWindow } from '../climate/nasa'

/* ------------------------------------------------------------------
   Climate library — the data foundation. Distinguishes clearly:
   • Historical / Representative climate (engineering data)
   • Live fetch (NASA POWER historical reanalysis — still not a forecast)
   Never presents forecast weather as climate-design data.
   ------------------------------------------------------------------ */

export default function Climate({ activeCase }: { activeCase: DesignCase | undefined }) {
  const [selectedLocId, setSelectedLocId] = useState<string>(activeCase?.locationId ?? 'leh')
  const [cached, setCached] = useState(() => listCachedProfiles())
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [csvErrors, setCsvErrors] = useState<string[]>([])

  const loc = findLocation(selectedLocId) ?? LOCATIONS[0]
  const profile: ClimateProfile = useMemo(() => getRepresentativeProfile(loc), [loc])
  const summary = useMemo(() => summarize(profile.points), [profile])

  // chart window: first 10 days of the profile
  const chartData = useMemo(() => profile.points.slice(0, 240).map((p) => ({ t: p.t, temp: p.temp, ghi: p.ghi })), [profile])

  const refreshCache = () => setCached(listCachedProfiles())

  const fetchLive = async () => {
    setBusy('live')
    setStatus(null)
    // recent historical window (design data = historical, not forecast)
    const end = new Date(Date.now() - 3 * 86400e3)
    const start = new Date(end.getTime() - 13 * 86400e3)
    const window: PowerWindow = { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
    const out = await fetchOrFallback(loc, window)
    refreshCache()
    setBusy(null)
    setStatus(out.message)
  }

  const onCsv = async (file: File) => {
    setCsvErrors([])
    setBusy('csv')
    try {
      const text = await file.text()
      const res = parseClimateCsv(text)
      if (res.errors.length) setCsvErrors(res.errors)
      if (res.points.length >= 24) {
        cacheProfile({
          id: `upload-${loc.id}-${Date.now().toString(36)}`,
          name: `${file.name} (uploaded)`,
          locationId: loc.id,
          kind: 'uploaded',
          source: 'User CSV upload',
          sourceNote: `Uploaded time series, ${res.points.length} hourly records. Schema: timestamp,temp_c,rh_pct,ghi_wm2,wind_ms.`,
          resolution: 'hourly',
          points: res.points,
          cachedAt: Date.now(),
          provenance: 'user-upload',
        })
        refreshCache()
        setStatus(`Uploaded ${res.points.length} hourly records from ${file.name}.`)
      } else if (!res.errors.length) {
        setCsvErrors(['Not enough valid rows (need ≥ 24 hourly records).'])
      }
    } catch {
      setCsvErrors(['Could not read the file.'])
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="animate-fadeUp">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Climate Data</h1>
          <p className="text-sm text-ink-400 mt-1">
            Location → coordinates → climate provider → hourly time series → local cache → simulation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="teal"><span className="w-1.5 h-1.5 rounded-full bg-teal-accent animate-pulseDot" /> Climate profile cached</Badge>
          <Badge tone="blue">Offline analysis available</Badge>
        </div>
      </div>

      {/* offline pipeline */}
      <Card className="mb-5">
        <div className="px-5 py-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <Pipe>ONLINE · acquire</Pipe><Arrow /><Pipe>CACHE · localStorage</Pipe><Arrow /><Pipe>OFFLINE · simulate</Pipe>
          <span className="ml-3 text-ink-400 font-normal">
            Core calculation needs no continuous connection once the profile is cached.
          </span>
        </div>
      </Card>

      {/* location grid */}
      <SectionTitle>Stations</SectionTitle>
      <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
        {LOCATIONS.map((l) => (
          <button key={l.id} onClick={() => { setSelectedLocId(l.id); refreshCache() }}>
            <Card className={`h-full text-left transition-all ${selectedLocId === l.id ? 'border-teal-accent ring-1 ring-teal-accent/30' : 'hover:border-ink-300'}`}>
              <div className="p-4">
                <div className="text-sm font-bold text-ink-800">{l.name}</div>
                <div className="text-[11px] text-ink-400 mt-0.5">{l.region}</div>
                <div className="mt-2 text-[11px] font-mono text-ink-500">{l.lat.toFixed(2)}°, {l.lon.toFixed(2)}°</div>
                <div className="mt-1 text-[11px] text-ink-400">{l.elevationM} m · {l.descriptor}</div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      {/* selected location details */}
      <SectionTitle>Profile — {loc.name}, {loc.region}</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatTile label="Avg Temperature" value={summary.avgTempC.toFixed(1)} unit="°C" />
        <StatTile label="Min / Max" value={`${summary.minTempC.toFixed(0)}/${summary.maxTempC.toFixed(0)}`} unit="°C" />
        <StatTile label="Insolation" value={summary.insolationKWhM2Day.toFixed(2)} unit="kWh/m²·d" tone="teal" />
        <StatTile label="Rel. Humidity" value={summary.avgRH.toFixed(0)} unit="%" />
        <StatTile label="Wind" value={summary.avgWindMs.toFixed(1)} unit="m/s" />
        <StatTile label="Records" value={`${summary.hours}`} unit="h" hint={`${summary.days} days`} />
      </div>

      <div className="grid xl:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHead title="Ambient temperature — first 10 days" sub="Hourly representative series" right={<Badge tone="blue">Historical / Representative</Badge>} />
          <div className="p-3">
            <ClimateTempChart series={chartData} />
          </div>
        </Card>
        <Card>
          <CardHead title="Global horizontal irradiance" sub="Solar resource driving passive gains" />
          <div className="p-3">
            <ClimateSolarChart series={chartData} />
          </div>
        </Card>
      </div>

      {/* data source management */}
      <SectionTitle>Data Sources</SectionTitle>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHead title="NASA POWER (live fetch)" sub="Historical reanalysis — T2M · RH2M · ALLSKY_SFC_SW_DWN · WS2M" />
          <div className="p-5">
            <p className="text-[13px] text-ink-500 leading-relaxed">
              Attempts a live hourly fetch for {loc.name} (14-day historical window ending 3 days ago).
              If the API is unreachable, the prototype automatically continues with the cached
              representative profile — the UI never breaks on network failure.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={fetchLive} disabled={busy === 'live'}>
                {busy === 'live' ? 'Fetching…' : '⇣ Fetch live NASA POWER data'}
              </Button>
              <span className="text-[11px] text-ink-400">power.larc.nasa.gov · hourly · community RE</span>
            </div>
            {status && <div className="mt-3"><Callout tone="teal">{status}</Callout></div>}
          </div>
        </Card>
        <Card>
          <CardHead title="Upload CSV climate data" sub="timestamp,temp_c,rh_pct,ghi_wm2,wind_ms" />
          <div className="p-5">
            <p className="text-[13px] text-ink-500 leading-relaxed">
              Bring station data or authorized datasets as CSV. Uploaded profiles join the cache and are
              available to every simulation on this machine.
            </p>
            <label className="mt-3 inline-flex">
              <input
                type="file"
                accept=".csv,text/csv"
                className="block text-xs text-ink-500 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-ink-900 file:text-white file:text-xs file:font-semibold file:cursor-pointer"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsv(f) }}
              />
            </label>
            {busy === 'csv' && <p className="text-xs text-ink-400 mt-2">Parsing…</p>}
            {csvErrors.length > 0 && (
              <div className="mt-3">
                <Callout tone="warn">
                  <b>CSV issues:</b>
                  <ul className="list-disc ml-4 mt-1">{csvErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul>
                </Callout>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* cache table */}
      <SectionTitle right={<Badge>{cached.length} profiles cached</Badge>}>Climate Cache</SectionTitle>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-400 text-xs uppercase bg-ink-50/60">
                <th className="px-4 py-2 font-semibold">Profile</th>
                <th className="px-4 py-2 font-semibold">Kind</th>
                <th className="px-4 py-2 font-semibold">Source</th>
                <th className="px-4 py-2 font-semibold">Hours</th>
                <th className="px-4 py-2 font-semibold">Cached</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {cached.map((p) => (
                <tr key={p.id} className="border-t border-ink-50">
                  <td className="px-4 py-2 font-semibold text-ink-800">{p.name}</td>
                  <td className="px-4 py-2">
                    <Badge tone={p.kind === 'representative' ? 'teal' : p.kind === 'live' ? 'blue' : 'neutral'}>{p.kind}</Badge>
                  </td>
                  <td className="px-4 py-2 text-ink-500">{p.source}</td>
                  <td className="px-4 py-2 tabular-nums">{p.points.length}</td>
                  <td className="px-4 py-2 text-ink-400">{p.cachedAt ? new Date(p.cachedAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {p.kind !== 'representative' && (
                      <Button size="sm" variant="danger" onClick={() => { deleteCachedProfile(p.id); refreshCache() }}>Delete</Button>
                    )}
                  </td>
                </tr>
              ))}
              {cached.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-ink-400">Cache empty — select a station to generate its representative profile.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Callout tone="info">
        <b>Historical / Representative vs Live Weather / Forecast:</b> engineering simulation uses
        historical or representative time series (NASA POWER reanalysis or the built-in synthetic profiles).
        Forecasts are never used as design climate data.
      </Callout>
    </div>
  )
}

function Pipe({ children }: { children: string }) {
  return <span className="px-3 py-1.5 rounded-lg bg-ink-50 border border-ink-100 text-ink-600">{children}</span>
}
function Arrow() {
  return <span className="text-ink-300">→</span>
}
