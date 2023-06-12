import * as matchers from "jest-extended"

expect.extend(matchers)

it.browser = wrapIt(it)
it.browser.only = wrapIt(it.only)
it.browser.skip = wrapIt(it.skip)
it.browser.failing = wrapIt(it.failing)
it.browser.todo = wrapIt(it.todo)
it.browser.concurrent = wrapIt(it.concurrent)
it.browser.each = () => {
  throw new Error("it.browser.each is not supported")
}

function wrapIt(original: jest.It): jest.It {
  type ItFunction = {
    [K in keyof jest.It]: K extends "each"
      ? never
      : jest.It[K] extends (...args: infer A) => infer R
      ? (...args: A) => R
      : never
  }[keyof jest.It]

  const itWrapper: ItFunction = (name, fn, timeout) => {
    const isHeadful = process.env.HEADLESS === "false" && !process.env.CI

    if (!timeout) {
      // extend timeout to an hour for headful mode
      timeout = isHeadful ? 60 * 60 * 1000 : __BROWSER_SUITE_TIMEOUT__
    }

    const fnWrapper =
      fn &&
      (async () => {
        if (isHeadful) {
          try {
            await fn(null as any)
          } catch (e) {
            console.error(e)
            await new Promise((resolve) => browser.on("disconnected", resolve))
            throw e
          }
        }

        return fn(null as any)
      })

    original(`[browser] ${name}`, fnWrapper, timeout)
  }

  return itWrapper as jest.It
}
