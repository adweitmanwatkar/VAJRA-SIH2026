import type { LocationInfo } from '../domain/types'

/**
 * Reference locations for the prototype. Coordinates are real; climate
 * descriptors are demonstration scenarios only (no official DRDO dataset).
 */
export const LOCATIONS: LocationInfo[] = [
  {
    id: 'leh',
    name: 'Leh',
    region: 'Ladakh',
    country: 'India',
    lat: 34.15,
    lon: 77.58,
    elevationM: 3524,
    climateZone: 'Cold & Sunny (High Altitude)',
    descriptor: 'High Altitude Cold',
  },
  {
    id: 'jaisalmer',
    name: 'Jaisalmer',
    region: 'Rajasthan',
    country: 'India',
    lat: 26.92,
    lon: 70.92,
    elevationM: 225,
    climateZone: 'Hot Arid (Desert)',
    descriptor: 'Hot Arid Desert',
  },
  {
    id: 'srinagar',
    name: 'Srinagar',
    region: 'Jammu & Kashmir',
    country: 'India',
    lat: 34.08,
    lon: 74.8,
    elevationM: 1585,
    climateZone: 'Cold / Temperate (Valley)',
    descriptor: 'Cold / Temperate',
  },
  {
    id: 'tawang',
    name: 'Tawang',
    region: 'Arunachal Pradesh',
    country: 'India',
    lat: 27.59,
    lon: 91.87,
    elevationM: 2669,
    climateZone: 'Sub-alpine Cold',
    descriptor: 'Sub-alpine Cold',
  },
  {
    id: 'jodhpur',
    name: 'Jodhpur',
    region: 'Rajasthan',
    country: 'India',
    lat: 26.24,
    lon: 73.02,
    elevationM: 231,
    climateZone: 'Hot Semi-arid',
    descriptor: 'Hot Semi-arid',
  },
  {
    id: 'port-blair',
    name: 'Port Blair',
    region: 'Andaman & Nicobar',
    country: 'India',
    lat: 11.62,
    lon: 92.73,
    elevationM: 79,
    climateZone: 'Warm Humid (Island)',
    descriptor: 'Warm Humid',
  },
]

export function findLocation(id: string): LocationInfo | undefined {
  return LOCATIONS.find((l) => l.id === id)
}
