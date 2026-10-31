import assert from "node:assert/strict"
import { test } from "node:test"
import path from "node:path"
import { merge } from "webpack-merge"
import { monkey } from "../../../src"
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

const snapshotDir = path.resolve(__dirname, "__snapshots__/external.test.ts")

test("builds userscripts with external modules", () => testBuild(monkey(config), snapshotDir))

test("fails when an unnamed external module is referenced", async () => {
  const badConfig = merge({}, config, {
    module: {
      rules: [
        createHotLoaderRule({
          [config.entry as string]: (source) => source.replace(/\/\/removeMe/g, ""),
        }),
      ],
    },
  })

  await assert.rejects(testBuild(monkey(badConfig), snapshotDir), /unnamed external/)
})
