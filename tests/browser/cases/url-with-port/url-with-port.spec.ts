import { expect } from "@playwright/test"
import path from "node:path"
import { monkey } from "../../../../src"
import { useDevServer, withCommonConfig } from "../../../utils/webpack"
import { test } from "../../env"

const config = monkey(
  withCommonConfig({
    entry: path.resolve(__dirname, "index.js"),
    output: {
      path: path.resolve(__dirname, "dist"),
    },
    devServer: {
      host: "localhost",
      static: {
        directory: path.resolve(__dirname, "../.."),
      },
    },
  }),
)

test("matches an include URL when the page has a port", async ({ page, installDevScript }) => {
  await useDevServer(config, async ({ origin }) => {
    await installDevScript(origin)
    await page.goto(origin)

    await expect(page.locator(".url-with-port")).toBeAttached()
  })
})
