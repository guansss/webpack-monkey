import {
  chromium,
  expect,
  test as baseTest,
  type BrowserContext,
  type Page,
} from "@playwright/test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { DEV_SCRIPT } from "../../src/shared/constants"
import { managers, type ManagerId } from "./setup"

declare const chrome: {
  userScripts: {
    getScripts(): Promise<unknown[]>
  }
}

export const TEST_PAGE = "/fixture.html"

export interface BrowserTestOptions {
  manager: ManagerId
}

const dashboards: Record<ManagerId, { path: string; text: string }> = {
  violentmonkey: { path: "options/index.html", text: "Installed scripts" },
  tampermonkey: { path: "options.html", text: "Installed Userscripts" },
}

export const test = baseTest.extend<
  BrowserTestOptions & {
    extensionId: string
    installDevScript: (origin: string) => Promise<void>
  }
>({
  manager: ["violentmonkey", { option: true }],
  context: async ({ manager }, use) => {
    const extensionDir = managers[manager].dir
    expect(fs.existsSync(path.join(extensionDir, "manifest.json"))).toBeTruthy()

    const userDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "webpack-monkey-"))
    let context = await launchManager(extensionDir, userDataDir)

    try {
      const worker = await getExtensionWorker(context)
      const extensionId = new URL(worker.url()).hostname

      await enableUserScripts(context, extensionId)
      await context.close()
      context = await launchManager(extensionDir, userDataDir, true)

      const restartedWorker = await getExtensionWorker(context, extensionId)
      await expect(
        restartedWorker.evaluate(async () => {
          await chrome.userScripts.getScripts()
          return true
        }),
      ).resolves.toBeTruthy()

      const dashboard = await context.newPage()
      await dashboard.goto(`chrome-extension://${extensionId}/${dashboards[manager].path}`)
      await expect(dashboard.locator("body")).toContainText(dashboards[manager].text)
      await dashboard.close()

      await use(context)
    } finally {
      await context.close()
      await fs.promises.rm(userDataDir, { recursive: true, force: true })
    }
  },
  extensionId: async ({ context }, use) => {
    const worker = await getExtensionWorker(context)
    await use(new URL(worker.url()).hostname)
  },
  installDevScript: async ({ context, extensionId, manager }, use) => {
    await use((origin) =>
      manager === "tampermonkey"
        ? installDevScriptWithTampermonkey(context, extensionId, `${origin}/${DEV_SCRIPT}`)
        : installDevScriptWithViolentmonkey(context, extensionId, `${origin}/${DEV_SCRIPT}`),
    )
  },
})

// Chromium is the only engine Playwright can load extensions in, and the only one
// exposing chrome.userScripts, which the Manifest V3 managers need
async function launchManager(extensionDir: string, userDataDir: string, reportErrors = false) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  })
  if (reportErrors) {
    context.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        console.error(`[browser:${message.type()}] ${message.text()}`)
      }
    })
    context.on("weberror", (error) => console.error(`[browser] ${error.error()}`))
  }
  return context
}

async function getExtensionWorker(context: BrowserContext, extensionId?: string) {
  const matches = (url: string) =>
    url.startsWith("chrome-extension://") && (!extensionId || new URL(url).hostname === extensionId)

  return (
    context.serviceWorkers().find((worker) => matches(worker.url())) ||
    (await context.waitForEvent("serviceworker", (worker) => matches(worker.url())))
  )
}

async function enableUserScripts(context: BrowserContext, extensionId: string) {
  const page = await context.newPage()
  await page.goto(`chrome://extensions/?id=${extensionId}`)

  await expect
    .poll(() => setUserScriptsToggle(page), {
      message: "The Allow User Scripts toggle was not available",
    })
    .toBeTruthy()

  await page.close()
}

async function setUserScriptsToggle(page: Page) {
  return page.evaluate(() => {
    const elements: Element[] = []
    const visit = (root: Document | ShadowRoot) => {
      for (const element of root.querySelectorAll("*")) {
        elements.push(element)
        if (element.shadowRoot) visit(element.shadowRoot)
      }
    }
    visit(document)

    const setting = elements.find((element) => element.id === "allow-user-scripts")
    const toggle =
      setting?.shadowRoot?.querySelector("cr-toggle") ||
      setting?.querySelector("cr-toggle") ||
      elements.find(
        (element) =>
          element.tagName === "CR-TOGGLE" &&
          element.parentElement?.textContent?.toLowerCase().includes("allow user scripts"),
      )

    if (!(toggle instanceof HTMLElement)) return false
    if (!(toggle as HTMLElement & { checked?: boolean }).checked) toggle.click()
    return (toggle as HTMLElement & { checked?: boolean }).checked === true
  })
}

async function installDevScriptWithViolentmonkey(
  context: BrowserContext,
  extensionId: string,
  devScriptUrl: string,
) {
  const installPage = await context.newPage()
  await installPage.goto(devScriptUrl).catch((error) => {
    if (!String(error).includes("ERR_ABORTED")) throw error
  })
  await installPage.waitForURL((url) => url.hostname === extensionId)

  await installPage.locator("#confirm").click()
  await expect(installPage.locator("#confirm")).toBeDisabled()
}

/**
 * Tampermonkey does not intercept navigations to *.user.js in a fresh profile,
 * so the script is installed through the dashboard's "Import from URL" field.
 */
async function installDevScriptWithTampermonkey(
  context: BrowserContext,
  extensionId: string,
  devScriptUrl: string,
) {
  const dashboard = await context.newPage()
  await dashboard.goto(`chrome-extension://${extensionId}/options.html#nav=utils`)

  const urlRow = dashboard.locator("div:has(> input.updateurl_input)")
  await urlRow.locator("input.updateurl_input").fill(devScriptUrl)
  await urlRow.locator("input.button").click()

  let installPage: Page | undefined
  await expect
    .poll(
      () => {
        installPage = context.pages().find((page) => page.url().includes("/ask.html"))
        return !!installPage
      },
      { message: "Tampermonkey's install page did not open", timeout: 15000 },
    )
    .toBeTruthy()

  await installPage!.locator("input.button.install").first().click()

  await dashboard.close()
}
