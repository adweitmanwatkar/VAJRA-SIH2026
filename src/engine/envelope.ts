import type { EnvelopeLayers, Material, Shelter } from '../domain/types'
import { findMaterial } from '../data/materials'

/* ------------------------------------------------------------------
   Envelope builder — turns material selections into U-values and
   areal heat capacities for wall / roof / floor assemblies.
   ------------------------------------------------------------------ */

/**
 * Effective exterior surface coefficient h_out (W/m²K) from wind speed.
 * Classic facade correlation h = 5.8 + 4.1·v (v in m/s).
 */
export function exteriorFilm(vWind: number): number {
  return 5.8 + 4.1 * vWind
}

const H_IN = 8.0 // W/m²K interior surface coefficient (mixed convection)
export const H_IN_VALUE = H_IN

export interface EnvelopeInput {
  wall: Material
  roof: Material
  floor: Material
  insulation: Material | null
  insulationThicknessM: number
}

export interface Assemblies {
  wall: EnvelopeLayers
  roof: EnvelopeLayers
  floor: EnvelopeLayers
  insulation: EnvelopeLayers | null
}

/** Build layered assembly properties for one envelope element */
export function buildEnvelope(layers: { material: Material; thicknessM: number }[]): EnvelopeLayers {
  let rSum = 0
  let cAreal = 1e4 // light-air/base furniture allowance, J/m²K
  let thick = 0
  const out: EnvelopeLayers['layers'] = []
  for (const l of layers) {
    if (!l.material || l.thicknessM <= 0) continue
    const r = l.thicknessM / l.material.conductivity
    rSum += r
    cAreal += l.material.density * l.material.specificHeat * l.thicknessM
    thick += l.thicknessM
    out.push({ name: l.material.name, thicknessM: l.thicknessM, uContrib: r > 0 ? 1 / r : 0 })
    // uContrib is layer conductance (1/R) — shown for transparency
  }
  const u = 1 / (rSum + 1 / H_IN + 1 / exteriorFilm(1.5))
  return { u, arealCapacity: cAreal, thickness: thick, layers: out }
}

export function buildAssemblies(shelter: Shelter, mats: Material[]): Assemblies {
  const wallMat = findMaterial(mats, shelter.wallMaterialId) ?? mats[0]
  const roofMat = findMaterial(mats, shelter.roofMaterialId) ?? mats[0]
  const floorMat = findMaterial(mats, shelter.floorMaterialId) ?? mats[0]
  const ins = shelter.insulationMaterialId ? findMaterial(mats, shelter.insulationMaterialId) ?? null : null

  const insLayer = (mult: number) =>
    ins && shelter.insulationThicknessM * mult > 0
      ? [{ material: ins, thicknessM: shelter.insulationThicknessM * mult }]
      : []

  const wall = buildEnvelope([{ material: wallMat, thicknessM: wallMat.thickness }, ...insLayer(1)])
  const roof = buildEnvelope([{ material: roofMat, thicknessM: roofMat.thickness }, ...insLayer(1)])
  const floor = buildEnvelope([{ material: floorMat, thicknessM: floorMat.thickness }, ...insLayer(0.5)])

  return { wall, roof, floor, insulation: insLayer(1).length ? buildEnvelope(insLayer(1)) : null }
}
