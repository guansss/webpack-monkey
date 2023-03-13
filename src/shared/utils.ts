import { matchPattern } from "browser-extension-url-match"
import { isNil } from "lodash"

/**
 * array.includes() with type guard.
 */
export function includes<T>(array: readonly T[], value: any): value is T {
  return array.includes(value)
}

export function urlMatch(pattern: string, url: string) {
  const matcher = matchPattern(pattern)

  if (!matcher.valid) {
    throw new TypeError("Invalid pattern: " + pattern)
  }

  return matcher.match(url)
}

export function parentUntil<T>(
  target: T | null | undefined,
  getParent: (target: T) => T | null | undefined,
  callback: (target: T) => void | boolean
): T | null | undefined {
  const visited = new Set<T>()

  let current = target
  let result = null

  while (!isNil(current) && !visited.has(current)) {
    visited.add(current)

    if (callback(current)) {
      result = current
      return result
    }

    current = getParent(current)
  }

  return result
}
