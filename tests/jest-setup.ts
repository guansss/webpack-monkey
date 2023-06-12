import type { Config } from "jest"
import type { Browser } from "puppeteer"
import { setupPuppeteerGlobals } from "./utils/pptr-globals"

declare global {
  var __jestPptr: { browsers: Browser[] }
}

let processed = false

module.exports = async function globalSetup(globalConfig: Config, projectConfig: Config) {
  await require("jest-environment-puppeteer/setup")(globalConfig)

  globalThis.__PUPPETEER_TIMEOUT__ = projectConfig.globals!.__PUPPETEER_TIMEOUT__ as number

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
