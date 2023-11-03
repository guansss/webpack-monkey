export interface CancelablePromise<T> extends Promise<T> {
  /**
   * When canceled, the Promise will never resolve/reject (if this method is correctly implemented...).
   */
  cancel(): void
}

/**
 * Periodically calls given function until the return value is truthy.
 * @returns A CancelablePromise that resolves with the function's return value when truthy.
 */
export function until<T>(fn: () => T, interval = 0): CancelablePromise<NonNullable<T>> {
  let cancelled = false

  const STOP = Symbol()

  const promise = new Promise<NonNullable<T>>((resolve, reject) => {
    const run = () => {
      if (cancelled) {
        return STOP
      }

      const result = fn()

      if (result) {
        resolve(result as NonNullable<T>)
        return STOP
      }
    }

    const timerId = setInterval(() => {
      try {
        if (run() === STOP) {
          clearInterval(timerId)
        }
      } catch (e) {
        reject(e)
        clearInterval(timerId)
      }
    }, interval)
  })

  ;(promise as CancelablePromise<any>).cancel = () => (cancelled = true)

  return promise as CancelablePromise<NonNullable<T>>
}
