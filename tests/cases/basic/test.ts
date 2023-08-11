import { it } from "@jest/globals"
import path from "path"
import { monkey } from "../../../src"
import { testBuild, usingDevServer, withCommonConfig } from "../../utils/webpack"
import { MonkeyPlugin } from "../../../src/node/MonkeyPlugin"
import { merge } from "webpack-merge"

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

it("build", () => testBuild(monkey(config)))

it("detects dev server's port when not defined", async () => {
  const newConfig = monkey(config)
  const plugin = newConfig.plugins!.find(
    (plugin): plugin is MonkeyPlugin => plugin instanceof MonkeyPlugin
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
