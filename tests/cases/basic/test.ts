import { it } from "@jest/globals"
import path from "path"
import { monkeyWebpack } from "../../../src"
import { testBuild, usingDevServer, withCommonConfig } from "../../utils/webpack"
import { MonkeyWebpackPlugin } from "../../../src/node/MonkeyWebpackPlugin"
import { merge } from "webpack-merge"

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

it("build", () => testBuild(monkeyWebpack()(config)))

it("detects dev server's port when not defined", async () => {
  const newConfig = monkeyWebpack()(config)
  const plugin = newConfig.plugins!.find(
    (plugin): plugin is MonkeyWebpackPlugin => plugin instanceof MonkeyWebpackPlugin
  )!

  expect(plugin.serveMode).toBe(false)

  const newConfigWithPort = merge({}, newConfig, {
    devServer: {
      port: __PORT__,
    },
  })

  await usingDevServer(
    {
      config: newConfigWithPort,
      noCompile: true,
    },
    async (server) => {
      expect(plugin.serveMode).toBe(true)
      expect(plugin.serverInfo!.port).toBe(__PORT__)
    }
  )
})
