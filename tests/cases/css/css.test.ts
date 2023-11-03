import path from "path"
import { monkey } from "../../../src"
import { test } from "../../env"
import { testBuild, withCommonConfig, withMiniCssExtract } from "../../utils/webpack"

const config = withCommonConfig(withMiniCssExtract(), {
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
})

test("build", () => testBuild(monkey(config)))
