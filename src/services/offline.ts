import { LOCATIONS } from '../data/locations'
import { getRepresentativeProfile } from '../climate/service'

/** Pre-cache representative profiles for every station (offline readiness). */
export function cacheAllRepresentativeProfiles(): void {
  for (const loc of LOCATIONS) {
    getRepresentativeProfile(loc)
  }
}
