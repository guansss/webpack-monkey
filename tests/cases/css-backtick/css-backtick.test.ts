import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import webpack from "webpack"
import { monkey } from "../../../src"
import { testBuild, withCommonConfig, withMiniCssExtract } from "../../utils/webpack"

/**
 * Verifies that backticks and ${} in CSS are properly escaped in the GM_addStyle template literal.
 * Regression test for https://github.com/guansss/webpack-monkey/issues/5
 */

const config = withCommonConfig(withMiniCssExtract(), {
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

test("build with CSS containing backticks and ${}", () =>
  testBuild(monkey(config), path.resolve(__dirname, "__snapshots__/css-backtick.test.ts")))

test("output GM_addStyle does not contain unescaped backticks or ${}", async () => {
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

  // Find the GM_addStyle call
  const gmAddStyleMatch = content.match(/GM_addStyle\(`([\s\S]*?[^\\])`\)/)
  assert.ok(gmAddStyleMatch, "should contain GM_addStyle(`...`)")

  const cssInTemplate = gmAddStyleMatch[1]!

  // Verify backticks are escaped
  const unescapedBacktick = /(?<!\\)`/.test(cssInTemplate)
  assert.ok(
    !unescapedBacktick,
    "backticks inside GM_addStyle template literal should be escaped with \\",
  )

  // Verify ${ sequences are escaped
  const unescapedDollarBrace = /(?<!\\)\$\{/.test(cssInTemplate)
  assert.ok(
    !unescapedDollarBrace,
    "${} inside GM_addStyle template literal should be escaped with \\",
  )

  // Verify the CSS content is actually present
  assert.ok(
    cssInTemplate.includes("\\`font-family\\`"),
    "CSS backtick content should be preserved (escaped)",
  )
  assert.ok(
    cssInTemplate.includes("\\${not-a-variable}"),
    "CSS ${} content should be preserved (escaped)",
  )
})
