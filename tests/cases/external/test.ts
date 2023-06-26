import { it } from "@jest/globals"
import path from "path"
import { monkeyWebpack } from "../../../src"
import { testBuild, withCommonConfig } from "../../utils/webpack"

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  externals: {
    "ex-named": "exNamed",
    ex: "EX",
  }
})

it("build", () => testBuild(monkeyWebpack()(config)), 100000000)
