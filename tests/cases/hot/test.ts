import path from "path"
import { monkeyWebpack } from "../../../src"
import { DEV_SCRIPT } from "../../../src/shared/constants"
import { installWithTampermonkey } from "../../utils/tampermonkey"
import { testBuild, usingDevServerHot, withCommonConfig } from "../../utils/webpack"

const config = withCommonConfig({
  mode: "development",
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  devServer: {
    port: __PORT__,
  },
})

it("build", () => testBuild(monkeyWebpack()(config)))

it("hot reload", async () => {
  await usingDevServerHot(monkeyWebpack()(config), async (server) => {
    await installWithTampermonkey(browser, page, `http://localhost:${__PORT__}/${DEV_SCRIPT}`)

    await page.goto(`http://localhost:${__PORT__}/webpack-dev-server/`)

    await page.waitForSelector("#div1")
    await page.waitForSelector("#div2")
    expect(await page.$("#div1")).toBe(null)
  })
}, 30_000)
