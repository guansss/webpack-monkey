import type { Config } from "jest"
import type { Browser } from "puppeteer"
import { setupPuppeteerGlobals } from "./utils/pptr-globals"

declare module globalThis {
  var __jestPptr: { browsers: Browser[] }
}

let processed = false

module.exports = async function globalSetup(globalConfig: Config) {
  await require("jest-environment-puppeteer/setup")(globalConfig)

  if (!processed) {
    processed = true

    const {
      __jestPptr: { browsers },
    } = globalThis

    await Promise.all(
      browsers.map((browser) => {
        return setupPuppeteerGlobals(browser)
      })
    )
  }
}
