import { expect } from "@playwright/test"
import path from "path"
import { merge } from "webpack-merge"
import { monkey } from "../../../src"
import { STRICT_CSP_PAGE, test } from "../../env"
import { testBuild, withCommonConfig, withMiniCssExtract } from "../../utils/webpack"

const entry = path.resolve(__dirname, "index.js")
const depA = path.resolve(__dirname, "depA.js")
const depB = path.resolve(__dirname, "depB.js")
const depC = path.resolve(__dirname, "depC.js")
const depCss = path.resolve(__dirname, "styles.css")

const config = withCommonConfig({
  entry: entry,
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

test("build", () => testBuild(monkey(withMiniCssExtract(config))))

test.describe("hot reload JS", () => {
  test("dependencies", async ({ page, devServerHot, installDevScript }) => {
    const { hotReload, origin } = await devServerHot(monkey(withMiniCssExtract(config)))

    await installDevScript(origin)
    await page.goto(origin + STRICT_CSP_PAGE)

    {
      await expect(page.locator(".index1")).toBeAttached()

      await hotReload({ [entry]: (s) => s.replace("index1", "index2") })

      await expect(page.locator(".index2")).toBeAttached()
      await expect(page.locator(".index1")).toHaveCount(0)
    }
    {
      await expect(page.locator(".depA1")).toHaveCount(1)
      await expect(page.locator(".depB1")).toHaveCount(1)
      await expect(page.locator(".depC1")).toHaveCount(1)

      await hotReload({ [depA]: (s) => s.replace("depA1", "depA2") })

      await expect(page.locator(".depA1")).toHaveCount(0)
      await expect(page.locator(".depA2")).toHaveCount(1)
      await expect(page.locator(".depB1")).toHaveCount(1)
      await expect(page.locator(".depC1")).toHaveCount(1)

      await hotReload({ [depC]: (s) => s.replace("depC1", "depC2") })

      await expect(page.locator(".depA2")).toHaveCount(1)
      await expect(page.locator(".depB1")).toHaveCount(1)
      await expect(page.locator(".depC1")).toHaveCount(0)
      await expect(page.locator(".depC2")).toHaveCount(1)
    }
  })
})

test.describe("hot reload CSS", () => {
  ;[
    ["css with mini-css-extract", withMiniCssExtract()] as const,
    // ["css with style-loader", withStyleLoader()],
  ].forEach(([name, cssConfig]) =>
    test(name, async ({ page, devServerHot, installDevScript }) => {
      const { hotReload, origin } = await devServerHot(monkey(merge({}, config, cssConfig)))

      await installDevScript(origin)
      await page.goto(origin + STRICT_CSP_PAGE)

      await expect(page.locator(".index1")).toBeAttached()
      await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 0, 0)")
      await expect(page.locator("body")).toHaveCSS("color", "rgb(255, 255, 255)")

      await hotReload({
        [depCss]: (s) =>
          s.replace("background-color: red;", "").replace("color: white;", "color: blue;"),
      })

      await expect(page.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
      await expect(page.locator("body")).toHaveCSS("color", "rgb(0, 0, 255)")
    }),
  )
})
