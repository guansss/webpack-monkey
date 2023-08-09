import { it } from "@jest/globals"
import path from "path"
import merge from "webpack-merge"
import { monkeyWebpack } from "../../../src"
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

it("build", () => testBuild(monkeyWebpack()(config)))

it("fails when an unnamed external module is referenced", async () => {
  const faultyConfig = merge({}, config, {
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

  await expect(testBuild(monkeyWebpack()(faultyConfig))).rejects.toThrowErrorMatchingInlineSnapshot(
    `"Unexpected reference to unnamed external module with URL "https://ex-url". This happens when you import a module from a URL but do not specify an identifier for it, e.g. \`import foo from "https://ex-url"\`, which will cause runtime errors in the generated code. To fix this, either add a universally unique identifier to the import statement, e.g. \`import foo from "foo@https://ex-url"\`, or do not import anything from it, e.g. \`import "https://ex-url"\`."`
  )
})
