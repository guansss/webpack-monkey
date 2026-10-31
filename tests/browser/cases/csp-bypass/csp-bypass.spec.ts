import { expect } from "@playwright/test"
import path from "node:path"
import { monkey } from "../../../../src"
import { useDevServer, withCommonConfig, withMiniCssExtract } from "../../../utils/webpack"
import { TEST_PAGE, test } from "../../env"

// A CSP that blocks page-originated network requests (connect-src 'none') and page
// stylesheets (style-src 'none').
const config = monkey(
  withMiniCssExtract(
    withCommonConfig({
      entry: path.resolve(__dirname, "index.js"),
      output: {
        path: path.resolve(__dirname, "dist"),
      },
      devServer: {
        static: {
          directory: path.resolve(__dirname, "../.."),
        },
        headers: {
          "Content-Security-Policy":
            "default-src 'self' 'unsafe-eval' 'unsafe-inline'; connect-src 'none'; style-src 'none'",
        },
      },
    }),
  ),
)

test("bypasses connect-src and style-src with GM APIs", async ({ page, installDevScript }) => {
  await useDevServer(config, async ({ origin }) => {
    await installDevScript(origin)
    await page.goto(origin + TEST_PAGE)

    // Sanity check: the CSP really does block page-originated requests and inline styles,
    // so the assertions below are meaningful and not passing by accident.
    const blocked = await page.evaluate(async (url) => {
      const fetchBlocked = await fetch(url)
        .then(() => false)
        .catch(() => true)
      const style = document.createElement("style")
      style.textContent = "body{outline:1px solid blue}"
      document.head.appendChild(style)
      const styleBlocked = getComputedStyle(document.body).outlineStyle !== "solid"
      style.remove()
      return { fetchBlocked, styleBlocked }
    }, origin + "/monkey-dev.user.js")
    expect(blocked.fetchBlocked, "page fetch() should be blocked by connect-src 'none'").toBe(true)
    expect(blocked.styleBlocked, "page <style> should be blocked by style-src 'none'").toBe(true)

    // The userscript ran (bundle fetched via GM_xmlhttpRequest despite connect-src 'none').
    await expect(page.locator(".css-ready")).toBeAttached()

    // The extracted CSS applied (injected via GM_addStyle despite style-src 'none').
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 0, 0)")
    await expect(page.locator("body")).toHaveCSS("color", "rgb(255, 255, 255)")
  })
})
