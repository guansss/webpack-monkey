import { expect } from "@playwright/test"
import path from "path"
import merge from "webpack-merge"
import { monkey } from "../../../src"
import { test } from "../../env"
import { createHotLoaderRule } from "../../utils/hot-loader"
import { testBuild, withCommonConfig } from "../../utils/webpack"

const config = withCommonConfig({
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  externals: {
    "ex-named": "exNamed",
    ex: "EX",
  },
})

test("build", () => testBuild(monkey(config)))

test("fails when an unnamed external module is referenced", async () => {
  const badConfig = merge({}, config, {
    module: {
      rules: [
        createHotLoaderRule({
          replacers: {
            [config.entry as string]: (s) => s.replace(/\/\/removeMe/g, ""),
          },
        }),
      ],
    },
  })

  await expect(testBuild(monkey(badConfig))).rejects.toThrow("unnamed external")
})
