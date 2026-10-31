import { expect } from "@playwright/test"
import path from "node:path"
import { monkey } from "../../../../src"
import { useDevServer, withCommonConfig } from "../../../utils/webpack"
import { TEST_PAGE, test } from "../../env"

const config = monkey(
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
)

test("runs a userscript that uses granted GM APIs", async ({ page, installDevScript }) => {
  await useDevServer(config, async ({ origin }) => {
    await installDevScript(origin)
    await page.goto(origin + TEST_PAGE)

    await expect(page.locator(".basic-ready")).toHaveText("basic ready")
  })
})
