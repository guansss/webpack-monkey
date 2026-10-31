import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import webpack from "webpack"
import { monkey } from "../../../src"
import { testBuild, withCommonConfig } from "../../utils/webpack"

/**
 * Build test with style-loader (instead of mini-css-extract-plugin).
 * Regression test for https://github.com/guansss/webpack-monkey/issues/8
 */

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
})

test("build with style-loader", () =>
  testBuild(monkey(config), path.resolve(__dirname, "__snapshots__/css-style-loader.test.ts")))

/**
 * Ensures the __MK_GLOBAL__ guard is present
 */
test("output contains __MK_GLOBAL__ guard for style-loader shim", async () => {
  const finalConfig = { ...monkey(config), mode: "production" as const }
  const compiler = webpack(finalConfig)

  const stats = await new Promise<webpack.StatsCompilation>((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) return reject(err)
      compiler.close(() => resolve(stats!.toJson()))
    })
  })

  const files = stats.chunks!.flatMap((chunk) => chunk.files)
  const content = fs.readFileSync(`${finalConfig.output!.path}/${files[0]}`, "utf-8")

  assert.ok(
    content.includes('typeof __MK_GLOBAL__ !== "undefined"'),
    "should guard __MK_GLOBAL__ access with typeof check",
  )
  assert.ok(
    content.includes("GM_addStyle"),
    "should contain GM_addStyle fallback for when __MK_GLOBAL__ is not defined",
  )
})
