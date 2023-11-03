import { expect } from "@playwright/test"
import path from "path"
import { merge } from "webpack-merge"
import { monkey } from "../../../src"
import { MonkeyPlugin } from "../../../src/node/MonkeyPlugin"
import { test } from "../../env"
import { getFreePort, testBuild, withCommonConfig } from "../../utils/webpack"
import axios from "axios"

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

test("build", () => testBuild(monkey(config)))

test("detects dev server's port when not defined", async ({ devServer }) => {
  const newConfig = monkey(config)
  const plugin = newConfig.plugins!.find(
    (plugin): plugin is MonkeyPlugin => plugin instanceof MonkeyPlugin,
  )!

  expect(plugin.serveMode).toBe(false)

  const port = await getFreePort()

  const newConfigWithPort = merge({}, newConfig, {
    devServer: {
      port,
    },
  })

  const server = await devServer({
    ...newConfigWithPort,
    noCompile: true,
  })

  expect(plugin.serveMode).toBe(true)
  expect(plugin.serverInfo!.port).toBe(port)
})
