import { expect } from "@playwright/test"
import path from "node:path"
import { monkey } from "../../../../src"
import { withCommonConfig, withMiniCssExtract } from "../../../utils/webpack"
import { TEST_PAGE, test } from "../../env"
import { useHotDevServer } from "../../hot-server"

const entry = path.resolve(__dirname, "index.js")
const depA = path.resolve(__dirname, "depA.js")
const depC = path.resolve(__dirname, "depC.js")
const stylesheet = path.resolve(__dirname, "styles.css")

const config = monkey(
  withMiniCssExtract(
    withCommonConfig({
      entry,
      output: {
        path: path.resolve(__dirname, "dist"),
      },
      devServer: {
        static: {
          directory: path.resolve(__dirname, "../.."),
        },
      },
    }),
  ),
)

test("hot reloads JavaScript dependencies", async ({ page, installDevScript, manager }) => {
  test.slow(
    manager === "tampermonkey",
    "Tampermonkey's GM_xmlhttpRequest polling reconnects slowly during recompiles",
  )

  await useHotDevServer(page, config, async ({ hotReload, origin }) => {
    await installDevScript(origin)
    await page.goto(origin + TEST_PAGE)

    await expect(page.locator(".index1")).toBeAttached()
    await hotReload({ [entry]: (source) => source.replace("index1", "index2") })
    await expect(page.locator(".index2")).toBeAttached()
    await expect(page.locator(".index1")).toHaveCount(0)

    await expect(page.locator(".depA1")).toHaveCount(1)
    await expect(page.locator(".depB1")).toHaveCount(1)
    await expect(page.locator(".depC1")).toHaveCount(1)

    await hotReload({ [depA]: (source) => source.replace("depA1", "depA2") })
    await expect(page.locator(".depA1")).toHaveCount(0)
    await expect(page.locator(".depA2")).toHaveCount(1)
    await expect(page.locator(".depB1")).toHaveCount(1)
    await expect(page.locator(".depC1")).toHaveCount(1)

    await hotReload({ [depC]: (source) => source.replace("depC1", "depC2") })
    await expect(page.locator(".depA2")).toHaveCount(1)
    await expect(page.locator(".depB1")).toHaveCount(1)
    await expect(page.locator(".depC1")).toHaveCount(0)
    await expect(page.locator(".depC2")).toHaveCount(1)
  })
})

test("hot reloads extracted CSS", async ({ page, installDevScript, manager }) => {
  test.skip(
    manager === "tampermonkey",
    "Tampermonkey's GM_xmlhttpRequest returns the stale stylesheet after a hot update",
  )

  await useHotDevServer(page, config, async ({ hotReload, origin }) => {
    await installDevScript(origin)
    await page.goto(origin + TEST_PAGE)

    await expect(page.locator(".index1")).toBeAttached()
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 0, 0)")
    await expect(page.locator("body")).toHaveCSS("color", "rgb(255, 255, 255)")

    await hotReload({
      [stylesheet]: (source) =>
        source.replace("background-color: red;", "").replace("color: white;", "color: blue;"),
    })

    await expect(page.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await expect(page.locator("body")).toHaveCSS("color", "rgb(0, 0, 255)")
  })
})
