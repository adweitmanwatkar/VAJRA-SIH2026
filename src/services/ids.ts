let counter = 0

/** Collision-safe-enough id for a single-browser prototype */
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}
