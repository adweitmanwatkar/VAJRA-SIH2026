import type { ClimatePoint, ClimateProfile, LocationInfo } from '../domain/types'
import { generateSyntheticProfile } from './synthetic'
import { fetchNasaPower, powerUrl, type PowerWindow } from './nasa'

/* ------------------------------------------------------------------
   Climate Service
   - cache (localStorage) of downloaded profiles  -> offline mode
   - CSV upload                                   -> user data
   - NASA POWER live fetch with graceful fallback -> representative
   ------------------------------------------------------------------ */

const CACHE_KEY = 'vajra.climateCache.v1'

interface CacheShape {
  profiles: ClimateProfile[]
}

function readCache(): CacheShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { profiles: [] }
    const parsed = JSON.parse(raw) as CacheShape
    if (!parsed || !Array.isArray(parsed.profiles)) return { profiles: [] }
    return parsed
  } catch {
    return { profiles: [] }
  }
}

function writeCache(c: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    // storage full/unavailable — cache is best-effort
  }
}

export function listCachedProfiles(): ClimateProfile[] {
  return readCache().profiles
}

export function getCachedProfile(id: string): ClimateProfile | undefined {
  return readCache().profiles.find((p) => p.id === id)
}

export function cacheProfile(p: ClimateProfile) {
  const c = readCache()
  const i = c.profiles.findIndex((x) => x.id === p.id)
  if (i >= 0) c.profiles[i] = p
  else c.profiles.push(p)
  writeCache(c)
}

export function deleteCachedProfile(id: string) {
  const c = readCache()
  writeCache({ profiles: c.profiles.filter((p) => p.id !== id) })
}

export function hasCachedProfile(id: string): boolean {
  return readCache().profiles.some((p) => p.id === id)
}

/** A profile is "cached for offline use" if it exists in the local cache store */
export function isCachedOffline(p: ClimateProfile | null | undefined): boolean {
  if (!p) return false
  if (p.kind === 'representative') return true
  return hasCachedProfile(p.id)
}

/* ------------------------- synthetic profiles ------------------------ */

/** Get (and cache) the built-in representative profile for a location */
export function getRepresentativeProfile(loc: LocationInfo): ClimateProfile {
  const cached = getCachedProfile(`syn-${loc.id}`)
  if (cached) return cached
  const p = generateSyntheticProfile(loc)
  cacheProfile(p)
  return p
}

/* ---------------------------- NASA POWER ---------------------------- */

export interface FetchOutcome {
  profile: ClimateProfile
  live: boolean
  message: string
  fallbackUsed: boolean
}

/**
 * Try a live NASA POWER fetch for the window; on any failure fall back to the
 * cached representative profile. Never throws — the UI must never break
 * because an external API is unavailable.
 */
export async function fetchOrFallback(loc: LocationInfo, window: PowerWindow): Promise<FetchOutcome> {
  const fallback = getRepresentativeProfile(loc)
  try {
    const live = await fetchNasaPower(loc, window)
    if (live && live.points.length >= 24) {
      cacheProfile(live)
      return {
        profile: live,
        live: true,
        fallbackUsed: false,
        message: `Live NASA POWER data loaded (${live.points.length} hourly records) and cached locally.`,
      }
    }
    return {
      profile: fallback,
      live: false,
      fallbackUsed: true,
      message: 'Live climate source unavailable. Continue with cached representative profile.',
    }
  } catch {
    return {
      profile: fallback,
      live: false,
      fallbackUsed: true,
      message: 'Live climate source unavailable. Continue with cached representative profile.',
    }
  }
}

export { powerUrl }
export type { PowerWindow }

/* ------------------------------ CSV upload --------------------------- */

export interface CsvResult {
  points: ClimatePoint[]
  errors: string[]
}

/**
 * Expected CSV schema (header row required, any order):
 * timestamp,temp_c,rh_pct,ghi_wm2,wind_ms
 *   timestamp: 'YYYY-MM-DDTHH:00' or 'YYYY-MM-DD HH:00' or 'YYYYMMDDHH'
 */
export function parseClimateCsv(text: string): CsvResult {
  const errors: string[] = []
  const points: ClimatePoint[] = []
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return { points, errors: ['CSV needs a header row and at least one data row.'] }
  }
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.startsWith(n)))
  const iT = idx(['timestamp', 'time', 'datetime', 'date'])
  const iTemp = idx(['temp'])
  const iRh = idx(['rh'])
  const iGhi = idx(['ghi'])
  const iWind = idx(['wind'])
  if (iT < 0 || iTemp < 0) {
    return { points, errors: ['Missing required columns: timestamp and temp_c. Expected header: timestamp,temp_c,rh_pct,ghi_wm2,wind_ms'] }
  }
  for (let ln = 1; ln < lines.length; ln++) {
    const cells = splitCsvLine(lines[ln])
    const t = parseTimestamp(cells[iT])
    const temp = Number(cells[iTemp])
    if (!t || !Number.isFinite(temp)) {
      errors.push(`Row ${ln + 1}: invalid timestamp or temperature — skipped.`)
      continue
    }
    const rh = iRh >= 0 ? Number(cells[iRh]) : 50
    const ghi = iGhi >= 0 ? Number(cells[iGhi]) : 0
    const wind = iWind >= 0 ? Number(cells[iWind]) : 1
    points.push({
      t,
      temp,
      rh: clamp(Number.isFinite(rh) ? rh : 50, 0, 100),
      ghi: Math.max(0, Number.isFinite(ghi) ? ghi : 0),
      wind: Math.max(0, Number.isFinite(wind) ? wind : 0),
    })
  }
  points.sort((a, b) => a.t.localeCompare(b.t))
  // de-duplicate timestamps (keep first)
  const seen = new Set<string>()
  const dedup = points.filter((p) => {
    if (seen.has(p.t)) return false
    seen.add(p.t)
    return true
  })
  if (dedup.length === 0) {
    errors.push('No valid rows found. Check the CSV format.')
  }
  return { points: dedup, errors }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQ = !inQ
    } else if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function parseTimestamp(s: string): string | null {
  const v = s.trim()
  // compact stamps: YYYYMMDDHH (NASA POWER) or YYYYMMDDHHMM
  if (/^\d{10}$/.test(v)) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(8, 10)}:00`
  }
  if (/^\d{12}$/.test(v)) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(8, 10)}:00`
  }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2})/)
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${m[4].padStart(2, '0')}:00`
  }
  const d = new Date(v)
  if (!Number.isNaN(d.getTime())) {
    const p = (x: number) => String(x).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`
  }
  return null
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/* ------------------------------ summary ----------------------------- */

export interface ClimateSummary {
  avgTempC: number
  minTempC: number
  maxTempC: number
  avgRH: number
  avgGhiWm2: number
  peakGhiWm2: number
  /** mean daily insolation kWh/m² */
  insolationKWhM2Day: number
  avgWindMs: number
  hours: number
  days: number
}

export function summarize(points: ClimatePoint[]): ClimateSummary {
  if (!points.length) {
    return {
      avgTempC: 0, minTempC: 0, maxTempC: 0, avgRH: 0, avgGhiWm2: 0,
      peakGhiWm2: 0, insolationKWhM2Day: 0, avgWindMs: 0, hours: 0, days: 0,
    }
  }
  let tSum = 0, rhSum = 0, ghiSum = 0, windSum = 0, peak = 0
  let tMin = Infinity, tMax = -Infinity
  for (const p of points) {
    tSum += p.temp
    rhSum += p.rh
    ghiSum += p.ghi
    windSum += p.wind
    if (p.ghi > peak) peak = p.ghi
    if (p.temp < tMin) tMin = p.temp
    if (p.temp > tMax) tMax = p.temp
  }
  const n = points.length
  const days = new Set(points.map((p) => p.t.slice(0, 10))).size
  const insolation = (ghiSum / 1000 / Math.max(1, days))
  return {
    avgTempC: tSum / n,
    minTempC: tMin,
    maxTempC: tMax,
    avgRH: rhSum / n,
    avgGhiWm2: ghiSum / n,
    peakGhiWm2: peak,
    insolationKWhM2Day: insolation,
    avgWindMs: windSum / n,
    hours: n,
    days,
  }
}
