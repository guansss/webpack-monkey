import { beforeAll, beforeEach } from "@jest/globals"
import { ConsoleMessage, Target } from "puppeteer"

export let logs: ConsoleMessage[] = []

export function clearLogs() {
  logs = []
}

beforeAll(() => {
  browser.on("targetcreated", async (target: Target) => {
    const page = await target.page()

    if (page) {
      page.on("console", (msg) => {
        logs.push(msg)
      })
    }
  })
})

beforeEach(() => {
  clearLogs()
})
