import path from "path"
import { Page } from "puppeteer"
import Server from "webpack-dev-server"
import { merge } from "webpack-merge"
import { webpackMonkey } from "../../../src"
import { DEV_SCRIPT } from "../../../src/shared/constants"
import { installWithTampermonkey } from "../../utils/tampermonkey"
import {
  testBuild,
  usingDevServerHot,
  withCommonConfig,
  withMiniCssExtract,
} from "../../utils/webpack"

const entry = path.resolve(__dirname, "index.js")
const depA = path.resolve(__dirname, "depA.js")
const depB = path.resolve(__dirname, "depB.js")
const depC = path.resolve(__dirname, "depC.js")
const depCss = path.resolve(__dirname, "styles.css")

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

it("build", () => testBuild(webpackMonkey(withMiniCssExtract(config))))

describe("hot reload", () => {
  it.browser("modules", async () => {
    await usingDevServerHot(
      { config: webpackMonkey(withMiniCssExtract(config)) },
      async (server, { replacers }) => {
        await installWithTampermonkey(browser, page, `http://localhost:${__PORT__}/${DEV_SCRIPT}`)
        await page.goto(`http://localhost:${__PORT__}/webpack-dev-server/`)

        const expectExactlyOnes = async (classes: string[]) => {
          const selector = classes.map((c) => `.${c}`).join(",")
          const received = await page.$$eval(selector, (els) => els.map((el) => el.className))
          expect(received).toIncludeSameMembers(classes)
        }

        {
          await page.waitForSelector(".index1")

          replacers[entry] = (s) => s.replace("index1", "index2")
          await invalidate(server)
          await page.waitForSelector(".index2")

          expect(await page.$(".index1")).toBeNull()

          delete replacers[entry]
        }
        {
          await expectExactlyOnes(["depA1", "depB1", "depC1"])

          replacers[depA] = (s) => s.replace("depA1", "depA2")
          await invalidate(server)
          await waitForInsertion(page, ".index1")

          await expectExactlyOnes(["depA2", "depB1", "depC1"])

          replacers[depC] = (s) => s.replace("depC1", "depC2")
          await invalidate(server)
          await waitForInsertion(page, ".index1")

          await expectExactlyOnes(["depA2", "depB1", "depC2"])
        }
      }
    )
  })

  it.browser.each([
    ["css with mini-css-extract", withMiniCssExtract()],
    // ["css with style-loader", withStyleLoader()],
  ])("%s", async (_, cssConfig) => {
    await usingDevServerHot(
      { config: webpackMonkey(merge({}, config, cssConfig)) },
      async (server, { replacers }) => {
        await installWithTampermonkey(browser, page, `http://localhost:${__PORT__}/${DEV_SCRIPT}`)
        await page.goto(`http://localhost:${__PORT__}/webpack-dev-server/`)
        await page.waitForSelector(".index1")

        const bodyBgColor = await page.evaluate(
          () => getComputedStyle(document.body).backgroundColor
        )
        expect(bodyBgColor).toBe("rgb(255, 0, 0)")

        replacers[depCss] = (s) =>
          s.replace("background-color: red;", "").replace("color: white;", "color: black;")
        await invalidate(server)

        await expect(
          page.waitForFunction(() => {
            const styles = getComputedStyle(document.body)
            return styles.backgroundColor === "rgba(0, 0, 0, 0)" && styles.color === "rgb(0, 0, 0)"
          })
        ).resolves.toBeTruthy()
      }
    )
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
