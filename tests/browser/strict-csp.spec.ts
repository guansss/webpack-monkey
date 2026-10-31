import { expect } from "@playwright/test"
import path from "node:path"
import { monkey } from "../../src"
import { useDevServer, withCommonConfig } from "../utils/webpack"
import { TEST_PAGE, test } from "./env"

const config = monkey(
  withCommonConfig({
    entry: path.resolve(__dirname, "fixture.ts"),
    output: {
      path: path.resolve(__dirname, "dist"),
    },
    devServer: {
      static: {
        directory: __dirname,
      },
      headers: {
        "Content-Security-Policy": "default-src 'self'",
      },
    },
  }),
)

test("warns when a strict CSP blocks the dev client", async ({ context, installDevScript }) => {
  await useDevServer(config, async ({ origin }) => {
    await installDevScript(origin)

    const page = await context.newPage()

    const warning = page.waitForEvent("console", {
      predicate: (message) =>
        message.type() === "warning" &&
        message.text().includes("[Monkey Dev]") &&
        message.text().includes("Content Security Policy"),
      timeout: 15000,
    })

    await page.goto(origin + TEST_PAGE)

    await warning

    // The userscript must not have run: the marker is never created under a strict CSP.
    await expect(page.locator("#webpack-monkey-browser-test")).toHaveCount(0)
  })
})
