import path from "path"
import { monkey } from "../../../src"
import { test } from "../../env"
import { testBuild, withCommonConfig} from "../../utils/webpack"
import { expect } from "@playwright/test"

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  devServer: {
    host: "localhost" // force host to be localhost because 127.0.0.1 will not match
  },
})

test("build", () => testBuild(monkey(config)))

test("Test url with port in the browser", async ({ page, devServerHot, installDevScript }) => {
  const { origin } = await devServerHot(monkey(config))

  await installDevScript(origin)

  await page.goto(origin)

  await expect(page.locator(".index1")).toBeAttached()
})