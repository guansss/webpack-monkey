import type { Browser, Page, Target } from "puppeteer"
import { colorize } from "../../src/node/color"
import type { SourceReplacer } from "./fake-update-loader"

declare global {
  interface Window {
    __PPTR_HOOK__: <T extends keyof PuppeteerHookMap>(
      type: T,
      ...args: Parameters<PuppeteerHookMap[T]>
    ) => ReturnType<PuppeteerHookMap[T]>
    __NEXT__: (replacer: SourceReplacer) => void
  }
}

export type PuppeteerHookMap = {
  nextUpdate: () => Promise<void>
}

const blockedUrls = ["tampermonkey.net"]

const pptrHooks: Partial<Record<keyof PuppeteerHookMap, PuppeteerHookMap[keyof PuppeteerHookMap]>> =
  {}

export function registerPuppeteerHook<T extends keyof PuppeteerHookMap>(
  type: T,
  handler: PuppeteerHookMap[T]
) {
  pptrHooks[type] = handler
}

export function unregisterPuppeteerHook<T extends keyof PuppeteerHookMap>(type: T) {
  delete pptrHooks[type]
}

export async function setupPuppeteerGlobals(browser: Browser) {
  const shouldBlock = (page: Page) => {
    const url = page.url()
    if (blockedUrls.some((pattern) => url.includes(pattern))) {
      return true
    }
    return false
  }

  browser.on("targetcreated", async (target: Target) => {
    try {
      const page = await target.page()
      if (page) {
        if (page.isClosed()) {
          return
        }

        if (shouldBlock(page)) {
          return page.close()
        }

        await setupForPage(page)
      }
    } catch (e) {
      if (!String(e).includes("TargetCloseError")) {
        throw e
      } // else ignore
    }
  })

  async function setupForPage(page: Page) {
    page.on("framenavigated", async (frame) => {
      if (frame === page.mainFrame()) {
        if (shouldBlock(page)) {
          return page.close()
        }
      }
    })

    page.on("console", async (msg) => {
      const type = msg.type()
      const getArgs = () =>
        Promise.all(
          msg.args().map((arg) =>
            arg.evaluate((x) => {
              try {
                const proto = Object.getPrototypeOf(x)
                if (proto === Object.prototype || proto === null) {
                  return JSON.stringify(x, null, 2)
                }
              } catch (ignored) {}
              return String(x)
            })
          )
        ).catch((e) => [`(Error parsing console arguments: ${e})`])

      switch (type) {
        case "log":
        case "info":
        case "debug":
          console[type](colorize("blue", `console.${type}`), ...(await getArgs()))
          break
        case "warning":
          console.warn(colorize("yellow", `console.${type}`), ...(await getArgs()))
          break
        case "error":
        case "assert":
          console.error(colorize("red", `console.${type}`), ...(await getArgs()))
        default:
          console.log(colorize("blue", `console.${type}`), msg.text())
      }
    })

    await page.exposeFunction("__PPTR_HOOK__", (type: keyof PuppeteerHookMap, ...args: any[]) => {
      if (!pptrHooks[type]) {
        throw new Error(`Puppeteer hook ${type} is not registered`)
      }

      return pptrHooks[type]!(...(args as []))
    })
  }
}
