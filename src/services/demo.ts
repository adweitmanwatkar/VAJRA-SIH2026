import type { DesignCase, Shelter, SimulationSettings } from '../domain/types'
import { newId } from './ids'

/* ------------------------------------------------------------------
   Demo scenarios — preconfigured design cases so the app is usable
   immediately. Demonstration data only; not official DRDO datasets.
   ------------------------------------------------------------------ */

export function defaultShelter(): Shelter {
  return {
    lengthM: 6,
    widthM: 3,
    heightM: 2.5,
    shape: 'rectangular',
    orientation: 'S',
    occupants: 8,
    activity: 'seated-light',
    internalLoadW: 200,
    windowCount: 2,
    windowAreaM2: 1.2,
    doorAreaM2: 1.8,
    ach: 1.0,
    wallMaterialId: 'plywood',
    roofMaterialId: 'steel-sheet',
    floorMaterialId: 'plywood',
    insulationMaterialId: 'pur-foam',
    insulationThicknessM: 0.05,
    extraThermalMassJk: 0,
  }
}

export function defaultSettings(): SimulationSettings {
  return {
    days: 7,
    timestepMin: 5,
    comfort: { minC: 18, maxC: 26, pmvEnabled: true },
  }
}

interface DemoSpec {
  name: string
  locationId: string
  shelter: Partial<Shelter>
}

const DEMO_SPECS: DemoSpec[] = [
  {
    name: 'Leh — High Altitude Cold Shelter',
    locationId: 'leh',
    shelter: {
      orientation: 'S',
      wallMaterialId: 'sandbag',
      roofMaterialId: 'concrete',
      floorMaterialId: 'concrete',
      insulationMaterialId: 'pur-foam',
      insulationThicknessM: 0.06,
      extraThermalMassJk: 2.5e6,
      windowAreaM2: 1.6,
      windowCount: 2,
      ach: 0.7,
    },
  },
  {
    name: 'Jaisalmer — Hot Arid Shelter',
    locationId: 'jaisalmer',
    shelter: {
      orientation: 'N',
      wallMaterialId: 'concrete',
      roofMaterialId: 'concrete',
      floorMaterialId: 'concrete',
      insulationMaterialId: 'eps',
      insulationThicknessM: 0.05,
      extraThermalMassJk: 1.5e6,
      windowAreaM2: 0.8,
      windowCount: 1,
      ach: 1.2,
    },
  },
  {
    name: 'Srinagar — Cold / Temperate Shelter',
    locationId: 'srinagar',
    shelter: {
      orientation: 'S',
      wallMaterialId: 'timber',
      roofMaterialId: 'steel-sheet',
      floorMaterialId: 'timber',
      insulationMaterialId: 'mineral-wool',
      insulationThicknessM: 0.08,
      extraThermalMassJk: 0.8e6,
      windowAreaM2: 1.4,
      windowCount: 2,
      ach: 0.8,
    },
  },
]

export function demoCase(spec: DemoSpec): DesignCase {
  const now = Date.now()
  return {
    id: newId('case'),
    name: spec.name,
    createdAt: now,
    updatedAt: now,
    locationId: spec.locationId,
    climateProfileId: `syn-${spec.locationId}`,
    shelter: { ...defaultShelter(), ...spec.shelter },
    settings: defaultSettings(),
    status: 'draft',
  }
}

export function createDemoCases(): DesignCase[] {
  return DEMO_SPECS.map(demoCase)
}

export const DEMO_CASE_NAMES = DEMO_SPECS.map((s) => s.name)
