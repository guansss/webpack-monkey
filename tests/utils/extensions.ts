import { Browser, Page, Target } from "puppeteer"

export async function installScript(browser: Browser, page: Page, scriptUrl: string) {
  try {
    await page.goto(scriptUrl)
  } catch (e) {
    if ((e as Error)?.message?.includes("ERR_ABORTED")) {
      // ignore because this error seems to always happen
    } else {
      throw e
    }
  }

  if (__EXT__ === "tm") {
    return installWithTampermonkey(browser)
  } else if (__EXT__ === "vm") {
    return installWithViolentmonkey(browser)
  } else {
    throw new Error(`Unknown extension type: "${__EXT__}"`)
  }
}

async function installWithTampermonkey(browser: Browser) {
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

async function installWithViolentmonkey(browser: Browser) {
  const installerTarget = await browser.waitForTarget((target) =>
    /extension:.+confirm\/index\.html/.test(target.url())
  )
  const installerPage = (await installerTarget.page())!
  const installBtn = await installerPage.waitForSelector("#confirm")
  await installBtn!.click()
  await installerPage.waitForSelector("#confirm[disabled]")
  await installerPage.close()
}
