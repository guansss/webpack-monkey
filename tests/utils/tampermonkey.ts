import { Browser, Page, Target } from "puppeteer"

export async function installWithTampermonkey(browser: Browser, page: Page, scriptUrl: string) {
  try {
    await page.goto(scriptUrl)
  } catch (e) {
    if ((e as Error)?.message?.includes("ERR_ABORTED")) {
      // ignore because this error seems to always happen
    } else {
      throw e
    }
  }

  const installerTarget = await browser.waitForTarget((target) =>
    /extension:.+ask\.html/.test(target.url())
  )
  const installerPage = (await installerTarget.page())!
  const installBtn = await installerPage.waitForSelector(".ask_action_buttons>.install")
  await installBtn!.click()

  await new Promise((resolve) => installerPage.once("close", resolve))

  if (!(browser as any).__tmListened) {
    ;(browser as any).__tmListened = true

    browser.on("targetcreated", async (target: Target) => {
      if (!/extension:.+ask\.html/.test(target.url())) {
        return
      }

      const askPage = (await target.page())!

      try {
        await askPage.waitForSelector(`[data-btn-id="skip_timeout_button"]`)
      } catch (ignored) {
        return
      }

      try {
        await askPage.$eval(`.ask_action_buttons button .fa-thumbs-up`, (el) => {
          el.parentElement!.click()
        })
      } catch (e) {
        console.error(`Error confirming: ${e}`)
      }
    })
  }
}
