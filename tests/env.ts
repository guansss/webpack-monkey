import { Page, test as baseTest, chromium, expect } from "@playwright/test"
import { noop } from "lodash"
import { DEV_SCRIPT } from "../src/shared/constants"
import { mustGetExtension } from "./extensions/extensions"
import {
  UseDevServerContext,
  UseDevServerHotContext,
  UseDevServerOptions,
  useDevServer,
  useDevServerHot,
} from "./utils/webpack"

function getEnv(name: string, defaultVal?: string): string {
  if (!defaultVal && !process.env[name]) {
    throw new Error(`Environment variable ${name} is not set.`)
  }
  return process.env[name] || defaultVal!!!!!!
}

export const EXT = getEnv("EXT")

export const STRICT_CSP_PAGE = "/strict-csp.html"

export const test = baseTest.extend<{
  extensionId: string
  devServer: (options: UseDevServerOptions) => Promise<UseDevServerContext>
  devServerHot: (options: UseDevServerOptions) => Promise<
    UseDevServerHotContext & {
      hotReload: (replacers: Record<string, (s: string) => string>) => Promise<void>
    }
  >
  installDevScript: (origin: string) => Promise<void>
}>({
  context: async ({ headless }, use) => {
    const extensionInfo = mustGetExtension(EXT)

    const persistentContext = await chromium.launchPersistentContext("", {
      headless,
      args: [
        headless ? "--headless=new" : "",
        `--disable-extensions-except=${extensionInfo.dir}`,
        `--load-extension=${extensionInfo.dir}`,
      ],
    })

    await use(persistentContext)
    await persistentContext.close()
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.backgroundPages()
    if (!background) background = await context.waitForEvent("backgroundpage")

    const extensionId = background.url().split("/")[2]
    expect(extensionId).toBeTruthy()
    await use(extensionId!)
  },
  devServer: async ({}, use) => {
    // runner should never reject or else the test will hang
    let runner: Promise<void> | undefined
    let done: () => void = noop

    await use((options) => {
      if (runner) throw new Error("dev server already running")

      return new Promise((resolve, reject) => {
        runner = useDevServer(options, (ctx) => {
          resolve(ctx)
          return new Promise((r) => (done = r))
        }).catch(reject)
      })
    })

    done()
    await runner
  },
  devServerHot: async ({ page }, use) => {
    let runner: Promise<void> | undefined
    let done: () => void = noop

    await use((options) => {
      if (runner) throw new Error("dev server already running")

      return new Promise((resolve, reject) => {
        runner = useDevServerHot(options, (ctx) => {
          resolve({
            ...ctx,
            async hotReload(replacers) {
              Object.assign(ctx.hotLoaderOptions.replacers, replacers)

              await Promise.all([
                page.waitForEvent("console", (msg) => msg.text() === "[HMR] App is up to date."),
                new Promise((r) => ctx.server.invalidate(r)),
              ])
            },
          })
          return new Promise((r) => (done = r))
        }).catch(reject)
      })
    })

    done()
    await runner
  },
  installDevScript: async ({ context, extensionId }, use) => {
    const installDevScript = async (origin: string) => {
      const [confirmPage] = await Promise.all([
        context.waitForEvent("page", (p) => p.url().includes(extensionId)),
        (await context.newPage()).goto(`${origin}/${DEV_SCRIPT}`).catch((e) => {
          // ignore ERR_ABORTED, which is caused by the extensions aborting this page
          // and opening their own confirmation page
          if (!String(e).includes("ERR_ABORTED")) {
            throw e
          }
        }),
      ])

      if (EXT === "tampermonkey") {
        // there are two buttons (Confirm, Cancel) matching this selector, we assume the first one is Confirm
        await confirmPage.locator(".ask_action_buttons>.install").first().click()

        if (!(context as any).__tmWatched) {
          ;(context as any).__tmWatched = true

          context.on("page", async (askPage: Page) => {
            if (!askPage.url().includes("ask.html")) {
              return
            }

            try {
              await Promise.race([
                askPage.waitForEvent("close"),
                (async () => {
                  await askPage
                    .locator(`[data-btn-id="skip_timeout_button"]`)
                    .waitFor({ timeout: 1000 })
                  await askPage
                    .locator(`.ask_action_buttons button .fa-thumbs-up`)
                    .evaluate((el) => {
                      el.parentElement!.click()
                    })
                })(),
              ])
            } catch (e) {
              console.error(`Error confirming: ${e}`)
            }
          })
        }
      } else if (EXT === "violentmonkey") {
        await confirmPage.locator("#confirm").click()
        await confirmPage.locator("#confirm[disabled]").waitFor()
      }
    }

    await use(installDevScript)
  },
})
