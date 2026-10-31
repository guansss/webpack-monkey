import { expect } from "@playwright/test"
import path from "node:path"
import { monkey } from "../../../../src"
import { getFreePort, useDevServer, withCommonConfig } from "../../../utils/webpack"
import { TEST_PAGE, test } from "../../env"

test("loads URL externals before running the userscript", async ({ page, installDevScript }) => {
  // the external is served by the dev server itself, so its URL depends on the port
  const port = await getFreePort()
  const vendorUrl = `http://127.0.0.1:${port}/cases/external/vendor.js`

  const config = monkey(
    withCommonConfig({
      entry: path.resolve(__dirname, "index.js"),
      output: {
        path: path.resolve(__dirname, "dist"),
      },
      externals: {
        ex: `exVendor@${vendorUrl}`,
      },
      devServer: {
        port,
        static: {
          directory: path.resolve(__dirname, "../.."),
        },
      },
    }),
  )

  await useDevServer(config, async ({ origin }) => {
    await installDevScript(origin)
    await page.goto(origin + TEST_PAGE)

    await expect(page.locator(".external-ready")).toHaveText("external ready")
  })
})
