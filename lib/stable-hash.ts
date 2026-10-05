/**
 * FNV-1a 32-bit hash. Deterministic across processes and machines, which is what
 * lets the catalogue, the demo offers and the database seed derive the same
 * numbers everywhere without storing them.
 */
export function stableHash(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}
