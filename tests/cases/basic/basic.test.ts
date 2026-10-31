import { test } from "node:test"
import assert from "node:assert/strict"
import path from "path"
import { merge } from "webpack-merge"
import { monkey } from "../../../src"
import { MonkeyPlugin } from "../../../src/node/MonkeyPlugin"
import { getFreePort, testBuild, useDevServer, withCommonConfig } from "../../utils/webpack"

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

/**
 * Basic build test: minimal userscript with GM_log grant.
 */
test("build", () =>
  testBuild(monkey(config), path.resolve(__dirname, "__snapshots__/basic.test.ts")))

test("preserves comments when enabled", () =>
  testBuild(
    monkey({
      ...config,
      monkey: {
        terserPluginOptions: {
          terserOptions: {
            format: {
              comments: true,
            },
          },
        },
      },
    }),
    path.resolve(__dirname, "__snapshots__/comments.test.ts"),
  ))

test("detects dev server's port when not defined", async () => {
  const newConfig = monkey(config)
  const plugin = newConfig.plugins!.find(
    (plugin): plugin is MonkeyPlugin => plugin instanceof MonkeyPlugin,
  )!

  assert.equal(plugin.serveMode, false)

  const port = await getFreePort()

  const newConfigWithPort = merge({}, newConfig, {
    devServer: {
      port,
    },
  })

  await useDevServer({ ...newConfigWithPort, noCompile: true }, async ({ origin }) => {
    assert.equal(plugin.serveMode, true)
    assert.equal(plugin.serverInfo!.port, port)
    assert.ok(origin.includes(`:${port}`), `dev server origin should contain port ${port}`)
  })
})
