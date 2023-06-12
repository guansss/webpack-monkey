import path from "path"
import Server from "webpack-dev-server"
import { monkeyWebpack } from "../../../src"
import { DEV_SCRIPT } from "../../../src/shared/constants"
import { installWithTampermonkey } from "../../utils/tampermonkey"
import { testBuild, usingDevServerHot, withCommonConfig } from "../../utils/webpack"
import { Page } from "puppeteer"

const entry = path.resolve(__dirname, "index.js")
const depA = path.resolve(__dirname, "depA.js")
const depB = path.resolve(__dirname, "depB.js")
const depC = path.resolve(__dirname, "depC.js")

const config = withCommonConfig({
  mode: "development",
  entry: entry,
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  devServer: {
    port: __PORT__,
  },
})

it("build", () => testBuild(monkeyWebpack()(config)))

it.browser("hot reload", async () => {
  page.setDefaultTimeout(__PUPPETEER_TIMEOUT__)

  const expectExactlyOnes = async (classes: string[]) => {
    const selector = classes.map((c) => `.${c}`).join(",")
    const received = await page.$$eval(selector, (els) => els.map((el) => el.className))
    expect(received).toIncludeSameMembers(classes)
  }

  await usingDevServerHot(monkeyWebpack()(config), async (server, replacers) => {
    await installWithTampermonkey(browser, page, `http://localhost:${__PORT__}/${DEV_SCRIPT}`)

    await page.goto(`http://localhost:${__PORT__}/webpack-dev-server/`)

    {
      await page.waitForSelector(".index1")

      replacers[entry] = (s) => s.replace("index1", "index2")
      await invalidate(server)
      await page.waitForSelector(".index2")

      expect(await page.$(".index1")).toBeNull()
    }
    {
      await expectExactlyOnes(["depA1", "depB1", "depC1"])

      replacers[depA] = (s) => s.replace("depA1", "depA2")
      await invalidate(server)
      await waitForInsertion(page, ".index2")

      await expectExactlyOnes(["depA2", "depB1", "depC1"])

      replacers[depC] = (s) => s.replace("depC1", "depC2")
      await invalidate(server)
      await waitForInsertion(page, ".index2")

      await expectExactlyOnes(["depA2", "depB1", "depC2"])
    }
  })
})

function invalidate(server: Server) {
  return new Promise((r) => server.invalidate(r))
}

function waitForInsertion(page: Page, selector: string, observingSelector = "body") {
  return page.waitForFunction(
    (selector, observingSelector) => {
      return new Promise<HTMLElement>((r) => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement && node.matches(selector)) {
                observer.disconnect()
                r(node)
              }
            })
          })
        })
        observer.observe(document.querySelector(observingSelector)!, { childList: true })
      })
    },
    {},
    selector,
    observingSelector
  )
}
