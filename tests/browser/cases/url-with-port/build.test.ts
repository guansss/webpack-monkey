import { test } from "node:test"
import path from "node:path"
import { monkey } from "../../../../src"
import { testBuild, withCommonConfig } from "../../../utils/webpack"

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

test("builds a userscript with an include URL", () =>
  testBuild(monkey(config), path.resolve(__dirname, "__snapshots__/build.test.ts")))
