import type { ClimatePoint, ClimateProfile, LocationInfo } from '../domain/types'

/* ------------------------------------------------------------------
   NASA POWER hourly point-access client.

   The prototype attempts a live fetch when asked; if the network or
   the service is unreachable it returns null and callers fall back to
   the cached/synthetic representative profile. Data that arrives from
   the API is cached in localStorage and clearly labeled by source.

   Hourly variables:
     T2M                — temperature at 2 m, °C
     RH2M               — relative humidity at 2 m, %
     ALLSKY_SFC_SW_DWN  — all-sky shortwave down, kW/m² (hourly)
     WS2M               — wind speed at 2 m, m/s
   ------------------------------------------------------------------ */

export const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/hourly/point'

export interface PowerWindow {
  /** ISO date 'YYYY-MM-DD' */
  start: string
  end: string
}

export interface PowerFetchResult {
  profile: ClimateProfile
  live: boolean
  message: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function powerUrl(loc: LocationInfo, window: PowerWindow): string {
  const params = new URLSearchParams({
    parameters: 'T2M,RH2M,ALLSKY_SFC_SW_DWN,WS2M',
    community: 'RE',
    longitude: String(loc.lon),
    latitude: String(loc.lat),
    start: window.start.replaceAll('-', ''),
    end: window.end.replaceAll('-', ''),
    format: 'JSON',
  })
  return `${POWER_BASE}?${params.toString()}`
}

/** fetch a live NASA POWER hourly profile for a window; null if unavailable */
export async function fetchNasaPower(
  loc: LocationInfo,
  window: PowerWindow,
  signal?: AbortSignal,
): Promise<ClimateProfile | null> {
  const url = powerUrl(loc, window)
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const json = await res.json()
    const p = json?.properties?.parameter
    if (!p || !p.T2M) return null
    const times: string[] = Object.keys(p.T2M)
    if (!times.length) return null
    times.sort()

    const points: ClimatePoint[] = times.map((t) => {
      // POWER hourly timestamps are 'YYYYMMDDHH'
      const Y = t.slice(0, 4)
      const MM = t.slice(4, 6)
      const DD = t.slice(6, 8)
      const HH = t.slice(8, 10)
      return {
        t: `${Y}-${MM}-${DD}T${HH}:00`,
        temp: num(p.T2M?.[t]),
        rh: num(p.RH2M?.[t]),
        ghi: Math.round(num(p.ALLSKY_SFC_SW_DWN?.[t]) * 1000), // kW/m² -> W/m²
        wind: num(p.WS2M?.[t]),
      }
    })

    const profile: ClimateProfile = {
      id: `power-${loc.id}-${window.start}_${window.end}`,
      name: `${loc.name} — NASA POWER ${window.start} → ${window.end}`,
      locationId: loc.id,
      kind: 'live',
      source: 'NASA POWER (hourly, live fetch)',
      sourceNote:
        'NASA POWER hourly point API (community RE): T2M, RH2M, ALLSKY_SFC_SW_DWN, WS2M. Historical satellite-modelled data — not a forecast.',
      resolution: 'hourly',
      points,
      cachedAt: Date.now(),
      provenance: `nasa-power:${window.start}:${window.end}`,
    }
    return profile
  } catch {
    return null
  }
}

function num(x: unknown): number {
  const v = typeof x === 'number' ? x : Number(x)
  return Number.isFinite(v) ? v : 0
}
