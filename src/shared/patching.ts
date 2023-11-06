// no, this is not a monkey patching
const patchedFlag = "__monkey_patched__"

export function markAsPatched(obj: any) {
  obj[patchedFlag] = true
}

export function isPatched(obj: any) {
  return patchedFlag in obj
}

export function overrideDescriptor<T extends object, K extends keyof T>(
  obj: T,
  prop: K,
  getDescriptor: (
    original: {
      value: T[K]
      descriptor: PropertyDescriptor | undefined
    },
    restore: () => void,
  ) => PropertyDescriptor,
): PropertyDescriptor {
  const value = obj[prop]
  const descriptor = Object.getOwnPropertyDescriptor(obj, prop)

  const newDescriptor = getDescriptor({ value, descriptor }, () => {
    if (descriptor) {
      Object.defineProperty(obj, prop, descriptor)
    } else {
      // we may have defined a new own property, then we need to delete it
      // so that the prototype's property descriptor will take effect
      delete obj[prop]

      obj[prop] = value
    }
  })

  // if not configurable, we just let it throw
  Object.defineProperty(obj, prop, newDescriptor)

  return newDescriptor
}

export function overrideValue<T extends object, K extends keyof T>(
  obj: T,
  prop: K,
  getValue: (original: T[K], restore: () => void) => T[K],
): T[K] {
  const newValue = overrideDescriptor(obj, prop, ({ value, descriptor }, restore) => ({
    configurable: true,
    enumerable: descriptor?.enumerable,
    value: getValue(value, restore),
  }))

  return newValue.value
}
