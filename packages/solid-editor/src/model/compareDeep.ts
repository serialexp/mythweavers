/**
 * Deep comparison for objects and arrays.
 * Used to compare node attributes and mark attributes.
 */
export function compareDeep(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!(a && typeof a === 'object') || !(b && typeof b === 'object')) return false

  const aIsArray = Array.isArray(a)
  if (Array.isArray(b) !== aIsArray) return false

  if (aIsArray) {
    const aArr = a as unknown[]
    const bArr = b as unknown[]
    if (aArr.length !== bArr.length) return false
    for (let i = 0; i < aArr.length; i++) {
      if (!compareDeep(aArr[i], bArr[i])) return false
    }
  } else {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    for (const p in aObj) {
      if (!(p in bObj) || !compareDeep(aObj[p], bObj[p])) return false
    }
    for (const p in bObj) {
      if (!(p in aObj)) return false
    }
  }
  return true
}
