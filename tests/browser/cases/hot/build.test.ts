import { test } from "node:test"
import path from "node:path"
import { monkey } from "../../../../src"
import { testBuild, withCommonConfig, withMiniCssExtract } from "../../../utils/webpack"

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

test("builds the hot-reload fixture", () =>
  testBuild(
    monkey(withMiniCssExtract(config)),
    path.resolve(__dirname, "__snapshots__/build.test.ts"),
  ))
