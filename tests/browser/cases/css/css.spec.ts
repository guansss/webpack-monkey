import { expect } from "@playwright/test"
import path from "node:path"
import type webpack from "webpack"
import { monkey } from "../../../../src"
import {
  useDevServer,
  withCommonConfig,
  withMiniCssExtract,
  withStyleLoader,
} from "../../../utils/webpack"
import { TEST_PAGE, test } from "../../env"

function createConfig(withCss: (config: webpack.Configuration) => webpack.Configuration) {
  return monkey(
    withCss(
      withCommonConfig({
        entry: path.resolve(__dirname, "index.js"),
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
}

const cases = [
  ["mini-css-extract-plugin", withMiniCssExtract],
  ["style-loader", withStyleLoader],
] as const

for (const [name, withCss] of cases) {
  test(`applies styles bundled with ${name}`, async ({ page, installDevScript }) => {
    await useDevServer(createConfig(withCss), async ({ origin }) => {
      await installDevScript(origin)
      await page.goto(origin + TEST_PAGE)

      await expect(page.locator(".css-ready")).toBeAttached()
      await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 0, 0)")
      await expect(page.locator("body")).toHaveCSS("color", "rgb(255, 255, 255)")
    })
  })
}
