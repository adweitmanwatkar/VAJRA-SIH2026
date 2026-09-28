import type { ClimatePoint, ClimateProfile, LocationInfo } from '../domain/types'

/* ------------------------------------------------------------------
   Deterministic, seeded synthetic climate profiles.

   These are REPRESENTATIVE demo time-series built from public
   climatological knowledge of each station (monthly means, typical
   diurnal amplitude, sky clearness). They are NOT station records and
   NOT official DRDO data. The schema matches the NASA POWER pipeline
   exactly, so cached/live data can replace them seamlessly.
   ------------------------------------------------------------------ */

export interface SeasonalSpec {
  /** monthly mean ambient temperature, °C (Jan..Dec) */
  monthlyMeanC: number[]
  /** typical diurnal swing amplitude, °C */
  diurnalAmpC: number
  /** hour of daily temperature minimum */
  tMinHour: number
  /** monthly mean daily solar insolation, kWh/m²/day (Jan..Dec) */
  monthlyInsolation: number[]
  /** typical monthly mean RH, % (Jan..Dec) */
  monthlyRH: number[]
  /** typical wind speed, m/s */
  wind: number
  /** annual dust/monsoon sky factor multipliers by month (0..1 clarity) */
  skyClarity: number[]
}

export const SEASONAL_SPECS: Record<string, SeasonalSpec> = {
  // Leh: high-altitude cold desert — severe winters, huge solar resource, dry air
  leh: {
    monthlyMeanC: [-8, -5.5, 0.5, 6, 10, 14.5, 18, 17.5, 12.5, 5.5, -1, -6],
    diurnalAmpC: 13,
    tMinHour: 6,
    monthlyInsolation: [3.1, 4.1, 5.2, 6.3, 6.9, 7.4, 7.2, 6.9, 6.2, 5.1, 3.9, 3.0],
    monthlyRH: [42, 38, 33, 30, 27, 24, 28, 33, 34, 36, 40, 44],
    wind: 3.2,
    skyClarity: [0.78, 0.8, 0.8, 0.78, 0.74, 0.66, 0.62, 0.64, 0.72, 0.8, 0.8, 0.78],
  },
  // Jaisalmer: hot arid desert — extreme summers, cool winters, dusty pre-monsoon
  jaisalmer: {
    monthlyMeanC: [16, 19.5, 25, 31, 35, 36.5, 33.5, 31.5, 30.5, 27, 21, 17],
    diurnalAmpC: 14,
    tMinHour: 5,
    monthlyInsolation: [4.2, 5.1, 6.1, 6.9, 7.4, 7.3, 6.1, 5.9, 6.0, 5.5, 4.5, 4.0],
    monthlyRH: [45, 38, 30, 24, 22, 28, 48, 55, 47, 37, 40, 45],
    wind: 3.8,
    skyClarity: [0.8, 0.79, 0.78, 0.74, 0.7, 0.6, 0.5, 0.52, 0.58, 0.72, 0.78, 0.8],
  },
  // Srinagar: cold temperate valley — snowy winters, mild wet summers
  srinagar: {
    monthlyMeanC: [1.5, 3.5, 8.5, 13.5, 17.5, 21.5, 24.5, 23.5, 19, 13.5, 7.5, 3],
    diurnalAmpC: 11,
    tMinHour: 6,
    monthlyInsolation: [2.5, 3.3, 4.3, 5.4, 6.2, 6.6, 6.1, 5.9, 5.1, 4.0, 2.9, 2.3],
    monthlyRH: [68, 65, 60, 55, 52, 51, 58, 60, 58, 57, 62, 68],
    wind: 2.2,
    skyClarity: [0.45, 0.48, 0.52, 0.58, 0.62, 0.6, 0.5, 0.52, 0.56, 0.56, 0.5, 0.45],
  },
  // Tawang: sub-alpine, monsoon-affected
  tawang: {
    monthlyMeanC: [-3, -1, 3, 7.5, 11, 14.5, 16.5, 16, 14, 9.5, 4, -0.5],
    diurnalAmpC: 10,
    tMinHour: 6,
    monthlyInsolation: [3.4, 4.0, 4.6, 5.3, 5.6, 4.6, 3.6, 3.8, 4.2, 4.4, 3.9, 3.4],
    monthlyRH: [48, 45, 48, 56, 64, 76, 82, 80, 74, 62, 55, 50],
    wind: 2.8,
    skyClarity: [0.7, 0.68, 0.62, 0.56, 0.52, 0.38, 0.28, 0.3, 0.4, 0.56, 0.64, 0.7],
  },
  // Jodhpur: hot semi-arid
  jodhpur: {
    monthlyMeanC: [17.5, 21, 26, 31.5, 35, 35.5, 32, 30, 29.5, 26.5, 21.5, 18],
    diurnalAmpC: 13,
    tMinHour: 5,
    monthlyInsolation: [4.4, 5.3, 6.2, 6.9, 7.3, 7.1, 5.9, 5.7, 5.9, 5.4, 4.6, 4.2],
    monthlyRH: [45, 38, 30, 25, 24, 30, 52, 58, 50, 38, 41, 46],
    wind: 3.5,
    skyClarity: [0.78, 0.77, 0.76, 0.72, 0.68, 0.58, 0.48, 0.5, 0.56, 0.7, 0.76, 0.78],
  },
  // Port Blair: warm humid island, low swing, monsoon peaks
  'port-blair': {
    monthlyMeanC: [26.5, 27, 28, 29, 29.5, 28.5, 27.5, 27.5, 27.5, 27.5, 27.5, 27],
    diurnalAmpC: 6,
    tMinHour: 5,
    monthlyInsolation: [4.9, 5.6, 6.2, 6.6, 6.3, 5.0, 4.2, 4.4, 4.7, 4.9, 4.7, 4.6],
    monthlyRH: [76, 75, 73, 72, 74, 79, 82, 82, 80, 79, 78, 77],
    wind: 3.4,
    skyClarity: [0.6, 0.62, 0.63, 0.62, 0.56, 0.42, 0.34, 0.36, 0.4, 0.46, 0.5, 0.56],
  },
}

/** mulberry32 — small deterministic PRNG so every run is reproducible */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** representative analysis year (non-leap) used by demo profiles */
export const REP_YEAR = 2023
const MONTH_START_DOY: number[] = (() => {
  let acc = 0
  return DAYS_IN_MONTH.map((d) => {
    const s = acc
    acc += d
    return s
  })
})()

function iso(doy: number, hour: number): string {
  // day-of-year -> month/day in the representative year
  let m = 0
  let d = doy
  while (m < 11 && d > DAYS_IN_MONTH[m]) {
    d -= DAYS_IN_MONTH[m]
    m++
  }
  const MM = String(m + 1).padStart(2, '0')
  const DD = String(d).padStart(2, '0')
  const HH = String(hour).padStart(2, '0')
  return `${REP_YEAR}-${MM}-${DD}T${HH}:00`
}

/**
 * Generate a full-year hourly representative profile for a location.
 * Deterministic: same location + seed => identical series.
 */
export function generateSyntheticProfile(loc: LocationInfo, seed?: number): ClimateProfile {
  const spec = SEASONAL_SPECS[loc.id] ?? SEASONAL_SPECS.jaisalmer
  const rnd = mulberry32(seed ?? hashCode(loc.id))
  const points: ClimatePoint[] = []

  for (let month = 0; month < 12; month++) {
    const meanC = spec.monthlyMeanC[month]
    const amp = spec.diurnalAmpC
    const insol = spec.monthlyInsolation[month] // kWh/m²/day
    const clarity = spec.skyClarity[month]
    const rhMean = spec.monthlyRH[month]

    for (let day = 0; day < DAYS_IN_MONTH[month]; day++) {
      const doy = MONTH_START_DOY[month] + day + 1
      // slow synoptic weather wandering (~3-day memory)
      const synoptic = (rnd() - 0.5) * 2 // -1..1
      const dayBias = synoptic * amp * 0.22

      for (let h = 0; h < 24; h++) {
        // diurnal temperature wave
        const phase = ((h - spec.tMinHour + 24) % 24) / 24
        const diurnal = -Math.cos(2 * Math.PI * phase) * (amp / 2)
        const hourJitter = (rnd() - 0.5) * 0.8
        const temp = round1(meanC + diurnal + dayBias + hourJitter)

        // clear-sky solar: sine peak at solar noon (13:00 local for these lon)
        const solarNoon = 13
        const dayFrac = (h - (solarNoon - 6)) / 12 // 0..1 across daylight
        const clearPeak = (insol * 1000) / 3.6 // rough peak W/m² from daily kWh
        let ghi = 0
        if (dayFrac > 0 && dayFrac < 1) {
          ghi = clearPeak * Math.sin(Math.PI * dayFrac) * clarity
          ghi *= 0.9 + rnd() * 0.2
          ghi = Math.max(0, Math.round(ghi))
        }

        const rh = Math.min(98, Math.max(8, Math.round(rhMean - (temp - meanC) * 1.6 + (rnd() - 0.5) * 6)))
        const wind = round1(Math.max(0.4, spec.wind * (0.75 + rnd() * 0.5) + (ghi > 400 ? 0.4 : 0)))

        points.push({ t: iso(doy, h), temp, rh, ghi, wind })
      }
    }
  }

  return {
    id: `syn-${loc.id}`,
    name: `${loc.name} — Representative Year`,
    locationId: loc.id,
    kind: 'representative',
    source: 'Synthetic / Cached Demo Dataset',
    sourceNote:
      'Representative synthetic year generated from public climatological knowledge (monthly means, diurnal range, sky clarity). Demonstration data — not station records.',
    resolution: 'hourly',
    points,
    cachedAt: Date.now(),
    provenance: `seeded:${hashCode(loc.id)}`,
  }
}

export function hashCode(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}
