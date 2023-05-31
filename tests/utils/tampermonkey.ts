import { Browser, Page } from "puppeteer"

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

  browser
    .waitForTarget((target) => /extension:.+ask\.html/.test(target.url()))
    .then(async (askTarget) => {
      const askPage = (await askTarget.page())!

      askPage.once("domcontentloaded", async () => {
        try {
          const isConfirmPage = !!(await askPage.$(`[data-btn-id="skip_timeout_button"]`))

          if (isConfirmPage) {
            await askPage.click(`.ask_action_buttons .fa-thumbs-up`)
          }
        } catch (e) {
          console.warn(`Error confirming: ${e}`)
        }
      })
    })
    .catch((ignored) => {
      console.error(ignored)
    })
}
