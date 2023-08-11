import { it } from "@jest/globals"
import path from "path"
import { webpackMonkey } from "../../../src"
import { testBuild, withCommonConfig, withMiniCssExtract } from "../../utils/webpack"

const config = withCommonConfig(withMiniCssExtract(), {
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

it("build", () => testBuild(webpackMonkey(config)))
