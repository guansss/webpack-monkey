import { test } from "node:test"
import path from "path"
import { monkey } from "../../../src"
import { testBuild, withCommonConfig, withMiniCssExtract } from "../../utils/webpack"

const config = withCommonConfig(withMiniCssExtract(), {
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

/**
 * CSS build test: global styles inlined via GM_addStyle, CSS modules with hashed class names.
 * Uses mini-css-extract-plugin to verify the plugin's CSS handling pipeline.
 */
test("build", () => testBuild(monkey(config), path.resolve(__dirname, "__snapshots__/css.test.ts")))
