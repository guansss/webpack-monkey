import { beforeAll, beforeEach } from "@jest/globals"
import { ConsoleMessage, Target } from "puppeteer"

export let logs: ConsoleMessage[] = []

export function clearLogs() {
  logs = []
}

async function onTargetCreated(target: Target) {
  const page = await target.page()

  page?.on("console", (msg) => {
    logs.push(msg)
  })
}

beforeAll(() => {
  browser.on("targetcreated", onTargetCreated)
})

afterAll(() => {
  browser.off("targetcreated", onTargetCreated)
})

beforeEach(() => {
  clearLogs()
})
