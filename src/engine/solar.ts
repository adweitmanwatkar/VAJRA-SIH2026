/* ------------------------------------------------------------------
   Solar model — clear-sky decomposition + orientation gains.
   Simple, documented, deterministic. Used to distribute the climate
   profile's global horizontal irradiance onto walls / roof / windows.
   ------------------------------------------------------------------ */

import type { ClimatePoint } from '../domain/types'

export const ORIENT_AZIMUTH: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
}

export interface SolarGeometry {
  latDeg: number
  /** day of year */
  doy: number
  /** local solar hour (0..24) */
  hour: number
}

export function solarDeclination(doy: number): number {
  // Cooper's equation, degrees
  return 23.45 * Math.sin((2 * Math.PI * (284 + doy)) / 365)
}

export function solarAltitudeAzimuth(latDeg: number, doy: number, solarHour: number): { alt: number; az: number } {
  const lat = (latDeg * Math.PI) / 180
  const dec = (solarDeclination(doy) * Math.PI) / 180
  // hour angle from solar noon
  const H = ((solarHour - 12) * 15 * Math.PI) / 180
  const sinAlt =
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)))
  // azimuth from north, clockwise
  const cosAz = (Math.sin(dec) - sinAlt * Math.sin(lat)) / Math.max(1e-6, Math.cos(alt) * Math.cos(lat))
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)))
  if (H > 0) az = 2 * Math.PI - az
  return { alt: (alt * 180) / Math.PI, az: (az * 180) / Math.PI }
}

/** incidence-angle factor on a vertical surface facing `azimuthDeg` */
export function verticalSurfaceFactor(altDeg: number, sunAzDeg: number, surfAzDeg: number): number {
  if (altDeg <= 0) return 0
  const rel = Math.abs(((sunAzDeg - surfAzDeg + 540) % 360) - 180) // 0 = facing sun
  const relRad = (rel * Math.PI) / 180
  const altRad = (altDeg * Math.PI) / 180
  // cos of incidence on vertical plane
  const cosI = Math.cos(altRad) * Math.cos(relRad)
  return Math.max(0, cosI)
}

/** roof gets roughly the horizontal beam + diffuse share */
export function roofFactor(altDeg: number, clarity: number): number {
  if (altDeg <= 0) return 0
  // beam ~ sin(alt); add diffuse so overcast days still charge the roof
  return Math.max(0.15 * (1 - clarity) + 0.0, Math.sin((altDeg * Math.PI) / 180) * 0.85 + 0.15 * (1 - clarity))
}

export interface SolarSplit {
  /** W/m² incident on the principal (glazing) facade: beam + diffuse */
  wall: number
  /** W/m² incident on the roof */
  roof: number
  sunUp: boolean
}

/**
 * Split GHI into wall / roof incident components.
 * The "principal" facade is the one the window faces (shelter orientation).
 *
 * Isotropic-sky model:
 *   GHI = DNI·cos(z) + Diffuse
 *   Wall incident = DNI·cos(incidence) + Diffuse·0.5 + GHI·albedo·0.5
 * Diffuse + ground-reflected terms ensure every facade receives a share
 * (a north wall still sees ~30 % of GHI, dominated by diffuse light).
 */
export function splitSolar(point: ClimatePoint, latDeg: number, orientation: string): SolarSplit {
  const doy = Number(point.t.slice(5, 7)) * 30 // coarse doy proxy (month-based)
  const hour = Number(point.t.slice(11, 13))
  if (point.ghi <= 1) return { wall: 0, roof: 0, sunUp: false }
  const { alt, az } = solarAltitudeAzimuth(latDeg, doy, hour + 0.5)
  const surfAz = ORIENT_AZIMUTH[orientation] ?? 180
  const altRad = (Math.max(0, alt) * Math.PI) / 180

  // clarity estimate: GHI vs theoretical clear max -> diffuse fraction
  const clearMax = 1100 * Math.max(0.05, Math.sin(altRad))
  const clarity = Math.min(1, point.ghi / Math.max(1, clearMax))
  // Erbs-style screening: clearer sky -> smaller diffuse share
  const diffuseFrac = clarity > 0.65 ? 0.18 : clarity > 0.35 ? 0.35 : 0.6
  const diffuse = point.ghi * diffuseFrac
  const beamHoriz = Math.max(0, point.ghi - diffuse)

  // beam on vertical surface
  const cosI = verticalSurfaceFactor(alt, az, surfAz)
  // horizontal diffuse onto vertical surface ~0.5 (isotropic sky view factor)
  const wall = beamHoriz * cosI + diffuse * 0.5 + point.ghi * 0.2 * 0.5

  const fRoof = roofFactor(alt, clarity)
  const roof = point.ghi * fRoof
  return { wall, roof, sunUp: alt > 0 }
}
